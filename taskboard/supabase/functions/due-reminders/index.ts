import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";
import { sendApnsNotification, type ApnsConfig } from "../_shared/apns.ts";

// Triggered on a schedule by pg_cron (see migrations/0004_due_reminders_cron.sql).
// Not authenticated by end-user JWT (cron has none) so it checks a shared
// secret header instead, set from the same Vault secret the cron job SQL
// reads.
//
// Sends two independent one-shot notifications per card:
//   - "due soon" when the card first enters the 24h window before its
//     due date (tracked via due_soon_notified_at)
//   - "due now" once the due date has actually passed (tracked via
//     due_notified_at)
// Pings whoever the card is assigned to (or every board member, if
// unassigned), over both Web Push and native iOS push (APNs).
Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: vapid, error: vapidError } = await client.rpc("get_vapid_keys");
  if (vapidError || !vapid?.private_key) {
    return new Response(JSON.stringify({ error: vapidError?.message ?? "vapid keys missing" }), { status: 500 });
  }

  const expectedSecret = (await client.rpc("get_cron_secret")) as { data: string | null };
  const providedSecret = req.headers.get("x-cron-secret");
  if (!expectedSecret.data || providedSecret !== expectedSecret.data) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  webpush.setVapidDetails(vapid.subject, vapid.public_key, vapid.private_key);

  const { data: apnsConfigData } = await client.rpc("get_apns_config");
  const apnsConfig = apnsConfigData as ApnsConfig | null;
  const apnsReady = !!(apnsConfig?.auth_key && apnsConfig?.key_id && apnsConfig?.team_id && apnsConfig?.bundle_id);

  const now = new Date();
  const soonWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  type Card = { id: string; title: string; due_date: string; assigned_to: string | null; board_id: string };

  async function notifyCard(card: Card, title: string): Promise<number> {
    let targetUserIds: string[] = [];
    if (card.assigned_to) {
      targetUserIds = [card.assigned_to];
    } else {
      const { data: members } = await client.from("board_members").select("user_id").eq("board_id", card.board_id);
      targetUserIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
    }
    if (targetUserIds.length === 0) return 0;

    let sent = 0;
    const body = card.title;
    const tag = `due-${card.id}`;
    const url = "/Hedonist/taskboard/";

    const { data: subs } = await client
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .in("user_id", targetUserIds);

    if (subs && subs.length > 0) {
      const payload = JSON.stringify({ title, body, tag, url });
      const toDelete: string[] = [];
      await Promise.allSettled(
        subs.map((s: { endpoint: string; p256dh: string; auth_key: string }) =>
          webpush
            .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload)
            .then(() => {
              sent++;
            })
            .catch((err: { statusCode?: number }) => {
              if (err?.statusCode === 404 || err?.statusCode === 410) toDelete.push(s.endpoint);
            }),
        ),
      );
      if (toDelete.length) {
        await client.from("push_subscriptions").delete().in("endpoint", toDelete);
      }
    }

    if (apnsReady) {
      const { data: nativeTokens } = await client
        .from("native_push_tokens")
        .select("platform, token")
        .in("user_id", targetUserIds);

      if (nativeTokens && nativeTokens.length > 0) {
        const toDeleteTokens: string[] = [];
        await Promise.allSettled(
          nativeTokens.map(async (t: { platform: string; token: string }) => {
            if (t.platform !== "ios") return;
            const result = await sendApnsNotification(apnsConfig!, t.token, { title, body, tag, url });
            if (result.ok) sent++;
            else if (result.shouldRemoveToken) toDeleteTokens.push(t.token);
          }),
        );
        if (toDeleteTokens.length) {
          await client.from("native_push_tokens").delete().in("token", toDeleteTokens);
        }
      }
    }

    return sent;
  }

  let processed = 0;
  let sentCount = 0;

  // Advance notice: card enters the 24h window before its due date.
  const { data: soonCards, error: soonError } = await client
    .from("cards")
    .select("id, title, due_date, assigned_to, board_id")
    .eq("is_done", false)
    .not("due_date", "is", null)
    .is("due_soon_notified_at", null)
    .gt("due_date", now.toISOString())
    .lte("due_date", soonWindowEnd.toISOString());
  if (soonError) return new Response(JSON.stringify({ error: soonError.message }), { status: 500 });

  for (const card of (soonCards ?? []) as Card[]) {
    sentCount += await notifyCard(card, "Скоро дедлайн");
    await client.from("cards").update({ due_soon_notified_at: now.toISOString() }).eq("id", card.id);
    processed++;
  }

  // Due-now notice: the due date has actually passed.
  const { data: dueCards, error: dueError } = await client
    .from("cards")
    .select("id, title, due_date, assigned_to, board_id")
    .eq("is_done", false)
    .not("due_date", "is", null)
    .is("due_notified_at", null)
    .lte("due_date", now.toISOString());
  if (dueError) return new Response(JSON.stringify({ error: dueError.message }), { status: 500 });

  for (const card of (dueCards ?? []) as Card[]) {
    sentCount += await notifyCard(card, "Дедлайн наступил");
    await client.from("cards").update({ due_notified_at: now.toISOString() }).eq("id", card.id);
    processed++;
  }

  return new Response(JSON.stringify({ processed, sent: sentCount }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
