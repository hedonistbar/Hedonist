import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Two roles in one function, distinguished by the request shape rather than
// a route, since Supabase Edge Functions are one entrypoint each:
//
//   - authorize: the app calls this (with the user's JWT, via
//     supabase.functions.invoke) to get the Google consent URL, then does a
//     full-page redirect to it itself.
//   - callback: Google redirects the browser straight to this same
//     function's public URL with ?code=...&state=... — no Supabase JWT is
//     attached, so this function must have verify_jwt disabled (see
//     supabase/config.toml) and identify the user via the one-time `state`
//     row instead.
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-auth`;

  if (code && state) {
    return handleCallback(SUPABASE_URL, SERVICE_ROLE_KEY, redirectUri, code, state);
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing Authorization" }), { status: 401 });
  }

  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: creds } = await serviceClient.rpc("get_google_oauth_credentials");
  const clientId = creds?.client_id as string | undefined;
  if (!clientId) {
    return new Response(JSON.stringify({ error: "Google Calendar ещё не настроен (нет Client ID)." }), {
      status: 400,
    });
  }

  const { data: stateRow, error: stateError } = await serviceClient
    .from("google_oauth_states")
    .insert({ user_id: userData.user.id })
    .select("state")
    .single();
  if (stateError || !stateRow) {
    return new Response(JSON.stringify({ error: "failed to create oauth state" }), { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
    state: stateRow.state,
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return new Response(JSON.stringify({ url: authUrl }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

const APP_URL = "https://hedonistbar.github.io/Hedonist/taskboard/";

function htmlResponse(message: string, status: number, redirectOnSuccess: boolean): Response {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Google Calendar</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center;
    justify-content: center; min-height: 100vh; margin: 0; background: #f5f4f2; color: #1c1c1e; text-align: center; }
  .box { padding: 32px; max-width: 360px; }
  a { color: #0a84ff; text-decoration: none; }
</style></head>
<body><div class="box"><p>${message}</p><p><a href="${APP_URL}">Вернуться в Ivchenko Hub</a></p></div>
${redirectOnSuccess ? `<script>setTimeout(()=>{location.href=${JSON.stringify(`${APP_URL}?google_calendar=connected`)}},1200)</script>` : ""}
</body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function handleCallback(
  supabaseUrl: string,
  serviceRoleKey: string,
  redirectUri: string,
  code: string,
  state: string,
): Promise<Response> {
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: stateRow } = await serviceClient
    .from("google_oauth_states")
    .delete()
    .eq("state", state)
    .select("user_id")
    .maybeSingle();
  if (!stateRow) {
    return htmlResponse("Ссылка устарела или уже использована. Вернитесь в приложение и попробуйте снова.", 400, false);
  }

  const { data: creds } = await serviceClient.rpc("get_google_oauth_credentials");
  if (!creds?.client_id || !creds?.client_secret) {
    return htmlResponse("Google Calendar не настроен на сервере.", 500, false);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    return htmlResponse(
      `Не удалось подключить Google Calendar: ${tokenData.error_description ?? tokenData.error ?? "неизвестная ошибка"}`,
      400,
      false,
    );
  }

  const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();
  if (tokenData.refresh_token) {
    await serviceClient.from("google_calendar_tokens").upsert(
      {
        user_id: stateRow.user_id,
        refresh_token: tokenData.refresh_token,
        access_token: tokenData.access_token,
        expires_at: expiresAt,
      },
      { onConflict: "user_id" },
    );
  } else {
    // Google only returns a refresh_token when the user actually saw the
    // consent screen — with prompt=consent that's every time, but fall back
    // to just refreshing the access token if it's ever missing.
    await serviceClient
      .from("google_calendar_tokens")
      .update({ access_token: tokenData.access_token, expires_at: expiresAt })
      .eq("user_id", stateRow.user_id);
  }

  return htmlResponse("Google Calendar подключён ✓", 200, true);
}
