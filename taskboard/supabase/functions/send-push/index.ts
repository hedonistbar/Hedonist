import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";
import { sendApnsNotification, type ApnsConfig } from "../_shared/apns.ts";

// Called by the client right after assigning a card to someone, to ping
// them immediately. Uses the caller's own JWT for the card lookup (so RLS
// naturally scopes this to cards on boards the caller is a member of), and
// the get_subscriptions_for_target() RPC (which re-checks board membership
// server-side) to fetch the assignee's push subscriptions despite the
// caller not owning them.
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing Authorization" }), { status: 401 });
  }

  let card_id: string | undefined;
  try {
    ({ card_id } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), { status: 400 });
  }
  if (!card_id) {
    return new Response(JSON.stringify({ error: "card_id required" }), { status: 400 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: card, error: cardError } = await userClient
    .from("cards")
    .select("id, title, assigned_to, board_id, boards(name)")
    .eq("id", card_id)
    .maybeSingle();

  if (cardError || !card || !card.assigned_to) {
    return new Response(
      JSON.stringify({ skipped: true, reason: cardError?.message ?? "no assignee" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: subs, error: subsError } = await userClient.rpc("get_subscriptions_for_target", {
    p_card_id: card_id,
    p_target_user_id: card.assigned_to,
  });
  if (subsError) {
    return new Response(JSON.stringify({ error: subsError.message }), { status: 403 });
  }
  const { data: nativeTokens, error: nativeError } = await userClient.rpc("get_native_tokens_for_target", {
    p_card_id: card_id,
    p_target_user_id: card.assigned_to,
  });
  if (nativeError) {
    return new Response(JSON.stringify({ error: nativeError.message }), { status: 403 });
  }
  if ((!subs || subs.length === 0) && (!nativeTokens || nativeTokens.length === 0)) {
    return new Response(JSON.stringify({ sent: 0, reason: "no subscriptions" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const boardName = Array.isArray(card.boards) ? card.boards[0]?.name : (card.boards as { name?: string } | null)?.name;
  const title = "Вам назначили карточку";
  const body = boardName ? `${card.title} — ${boardName}` : card.title;
  const tag = `card-${card.id}`;
  const url = "/Hedonist/taskboard/";

  let sent = 0;

  if (subs && subs.length > 0) {
    const { data: vapid, error: vapidError } = await serviceClient.rpc("get_vapid_keys");
    if (vapidError || !vapid?.private_key) {
      return new Response(JSON.stringify({ error: vapidError?.message ?? "vapid keys missing" }), {
        status: 500,
      });
    }
    webpush.setVapidDetails(vapid.subject, vapid.public_key, vapid.private_key);
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
      await serviceClient.from("push_subscriptions").delete().in("endpoint", toDelete);
    }
  }

  if (nativeTokens && nativeTokens.length > 0) {
    const { data: apnsConfig } = await serviceClient.rpc("get_apns_config");
    const config = apnsConfig as ApnsConfig | null;
    if (config?.auth_key && config?.key_id && config?.team_id && config?.bundle_id) {
      const toDelete: string[] = [];
      await Promise.allSettled(
        nativeTokens.map(async (t: { platform: string; token: string }) => {
          if (t.platform !== "ios") return;
          const result = await sendApnsNotification(config, t.token, { title, body, tag, url });
          if (result.ok) sent++;
          else if (result.shouldRemoveToken) toDelete.push(t.token);
        }),
      );
      if (toDelete.length) {
        await serviceClient.from("native_push_tokens").delete().in("token", toDelete);
      }
    }
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
