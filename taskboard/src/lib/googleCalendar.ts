import { supabase } from "./supabase";

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

export async function hasGoogleOauthConfigured(): Promise<boolean> {
  const { data } = await supabase.rpc("has_google_oauth_credentials");
  return Boolean(data);
}

export async function setGoogleOauthCredentials(
  clientId: string,
  clientSecret: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("set_google_oauth_credentials", {
    p_client_id: clientId,
    p_client_secret: clientSecret,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function hasGoogleCalendarConnected(): Promise<boolean> {
  const { data } = await supabase.rpc("has_google_calendar_connected");
  return Boolean(data);
}

/** Kicks off the OAuth flow with a full-page redirect to Google — the
 * browser leaves the app and comes back via the edge function's own
 * callback page, which then redirects into the app again. */
export async function connectGoogleCalendar(): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("google-calendar-auth", { body: {} });
  if (error || !data?.url) {
    return { ok: false, error: error?.message ?? data?.error ?? "Не удалось начать подключение." };
  }
  window.location.href = data.url;
  return { ok: true };
}

export async function disconnectGoogleCalendar(): Promise<void> {
  await supabase.rpc("disconnect_google_calendar");
}

export async function fetchGoogleCalendarEvents(): Promise<{
  connected: boolean;
  events: GoogleCalendarEvent[];
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke("google-calendar-events", { body: {} });
  if (error) return { connected: false, events: [], error: error.message };
  return data as { connected: boolean; events: GoogleCalendarEvent[]; error?: string };
}
