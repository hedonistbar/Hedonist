import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";
import { sendApnsNotification, type ApnsConfig } from "../_shared/apns.ts";

// Triggered on a schedule by pg_cron (see migrations/0004_due_reminders_cron.sql).
// Not authenticated by end-user JWT (cron has none) so it checks a shared
// secret header instead, set from the same Vault secret the cron job SQL
// reads. Finds cards due within the next 24h (or already overdue) that
// haven't been notified yet, and pings whoever they're assigned to (or
// every board member, if unassigned).
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
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: cards, error } = await client
    .from("cards")
    .select("id, title, due_date, assigned_to, board_id, is_done, due_notified_at")
    .eq("is_done", false)
    .not("due_date", "is", null)
    .is("due_notified_at", null)
    .lte("due_date", windowEnd.toISOString());

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!cards || cards.length === 0) {
    return new Response(JSON.stringify({ processed: 0, sent: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sentCount = 0;
  for (const card of cards) {
    let targetUserIds: string[] = [];
    if (card.assigned_to) {
      targetUserIds = [card.assigned_to];
    } else {
      const { data: members } = await client.from("board_members").select("user_id").eq("board_id", card.board_id);
      targetUserIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
    }

    if (targetUserIds.length > 0) {
      const { data: subs } = await client
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth_key")
        .in("user_id", targetUserIds);

      if (subs && subs.length > 0) {
        const overdue = new Date(card.due_date as string) < now;
        const payload = JSON.stringify({
          title: overdue ? "Просрочено" : "Скоро дедлайн",
          body: card.title,
          tag: `due-${card.id}`,
          url: "/Hedonist/taskboard/",
        });

        const toDelete: string[] = [];
        await Promise.allSettled(
          subs.map((s: { endpoint: string; p256dh: string; auth_key: string }) =>
            webpush
              .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload)
              .then(() => {
                sentCount++;
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
          const overdue = new Date(card.due_date as string) < now;
          const title = overdue ? "Просрочено" : "Скоро дедлайн";
          const body = card.title as string;
          const tag = `due-${card.id}`;
          const url = "/Hedonist/taskboard/";

          const toDeleteTokens: string[] = [];
          await Promise.allSettled(
            nativeTokens.map(async (t: { platform: string; token: string }) => {
              if (t.platform !== "ios") return;
              const result = await sendApnsNotification(apnsConfig!, t.token, { title, body, tag, url });
              if (result.ok) sentCount++;
              else if (result.shouldRemoveToken) toDeleteTokens.push(t.token);
            }),
          );
          if (toDeleteTokens.length) {
            await client.from("native_push_tokens").delete().in("token", toDeleteTokens);
          }
        }
      }
    }

    await client.from("cards").update({ due_notified_at: now.toISOString() }).eq("id", card.id);
  }

  return new Response(JSON.stringify({ processed: cards.length, sent: sentCount }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
