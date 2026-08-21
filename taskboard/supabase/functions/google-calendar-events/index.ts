import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Fetches the caller's own upcoming Google Calendar events (next 14 days).
// Refreshes the access token first if it's expired — Google access tokens
// last ~1h, refresh tokens don't expire (until revoked).
Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing Authorization" }), { status: 401 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: tokenRow } = await serviceClient
    .from("google_calendar_tokens")
    .select("refresh_token, access_token, expires_at")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!tokenRow) {
    return new Response(JSON.stringify({ connected: false, events: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let accessToken = tokenRow.access_token as string;

  if (new Date(tokenRow.expires_at as string).getTime() <= Date.now() + 60_000) {
    const { data: creds } = await serviceClient.rpc("get_google_oauth_credentials");
    if (!creds?.client_id || !creds?.client_secret) {
      return new Response(JSON.stringify({ connected: false, events: [], error: "not configured" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: tokenRow.refresh_token as string,
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        grant_type: "refresh_token",
      }),
    });
    const refreshData = await refreshRes.json();
    if (!refreshRes.ok || !refreshData.access_token) {
      // Refresh token revoked/invalid — drop the dead connection so the UI
      // can prompt to reconnect instead of failing silently forever.
      await serviceClient.from("google_calendar_tokens").delete().eq("user_id", userData.user.id);
      return new Response(JSON.stringify({ connected: false, events: [], error: "reconnect_required" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    accessToken = refreshData.access_token;
    const newExpiresAt = new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString();
    await serviceClient
      .from("google_calendar_tokens")
      .update({ access_token: accessToken, expires_at: newExpiresAt })
      .eq("user_id", userData.user.id);
  }

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  })}`;

  const eventsRes = await fetch(eventsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  const eventsData = await eventsRes.json();
  if (!eventsRes.ok) {
    return new Response(
      JSON.stringify({ connected: true, events: [], error: eventsData.error?.message ?? "fetch failed" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const events = (eventsData.items ?? []).map(
    (e: { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }) => ({
      id: e.id,
      title: e.summary ?? "(без названия)",
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      allDay: !e.start?.dateTime,
    }),
  );

  return new Response(JSON.stringify({ connected: true, events }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
