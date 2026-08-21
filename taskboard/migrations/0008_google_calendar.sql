-- Real Google Calendar integration (OAuth 2.0, not a mock). Unlike Apple
-- Calendar this works from a plain web app — no native shell needed — but
-- still needs a one-time app-wide setup: a free Google Cloud project with
-- an OAuth consent screen kept in "Testing" mode (add both users as test
-- users there to skip Google's verification review) and a Web-application
-- OAuth client. Client ID/Secret are entered once through the app's new
-- "📅 Google Calendar" settings screen (mirrors set_anthropic_api_key from
-- 0005) — never committed to git, stored encrypted in Vault.
--
-- Redirect URI to register in Google Cloud Console → Credentials → your
-- OAuth client: {SUPABASE_URL}/functions/v1/google-calendar-auth

-- ---------------------------------------------------------------------------
-- Short-lived CSRF state for the OAuth redirect round-trip. Google's
-- callback hits our edge function directly (no Supabase JWT), so this is
-- how the callback learns which user started the flow. Service-role only —
-- no policies means RLS denies all access except to service_role, which
-- bypasses RLS.
-- ---------------------------------------------------------------------------
create table google_oauth_states (
  state uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table google_oauth_states enable row level security;

-- ---------------------------------------------------------------------------
-- Per-user Google refresh/access tokens. Service-role only, same reasoning
-- as above — the client never reads or writes this table directly, only
-- through the RPCs below (status/disconnect) or the edge functions
-- (fetching/refreshing).
-- ---------------------------------------------------------------------------
create table google_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table google_calendar_tokens enable row level security;

create or replace function has_google_calendar_connected()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from google_calendar_tokens where user_id = auth.uid());
$$;
revoke execute on function has_google_calendar_connected() from public;
grant execute on function has_google_calendar_connected() to authenticated;

create or replace function disconnect_google_calendar()
returns void
language sql
security definer
set search_path = public
as $$
  delete from google_calendar_tokens where user_id = auth.uid();
$$;
revoke execute on function disconnect_google_calendar() from public;
grant execute on function disconnect_google_calendar() to authenticated;

-- ---------------------------------------------------------------------------
-- Shared OAuth app credentials (Client ID/Secret) — one pair for the whole
-- app, same pattern as the Anthropic key in 0005.
-- ---------------------------------------------------------------------------
create or replace function set_google_oauth_credentials(p_client_id text, p_client_secret text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_client_id), '') = '' or coalesce(trim(p_client_secret), '') = '' then
    raise exception 'client id and secret must not be empty';
  end if;

  select id into v_id from vault.secrets where name = 'google_oauth_client_id';
  if v_id is null then
    perform vault.create_secret(p_client_id, 'google_oauth_client_id');
  else
    perform vault.update_secret(v_id, p_client_id);
  end if;

  select id into v_id from vault.secrets where name = 'google_oauth_client_secret';
  if v_id is null then
    perform vault.create_secret(p_client_secret, 'google_oauth_client_secret');
  else
    perform vault.update_secret(v_id, p_client_secret);
  end if;
end;
$$;
revoke execute on function set_google_oauth_credentials(text, text) from public;
grant execute on function set_google_oauth_credentials(text, text) to authenticated;

create or replace function has_google_oauth_credentials()
returns boolean
language sql
security definer
set search_path = public, vault
stable
as $$
  select exists (select 1 from vault.secrets where name = 'google_oauth_client_id');
$$;
revoke execute on function has_google_oauth_credentials() from public;
grant execute on function has_google_oauth_credentials() to authenticated;

-- Called by the google-calendar-auth/google-calendar-events edge functions
-- (service role only) to read the credentials out of Vault.
create or replace function get_google_oauth_credentials()
returns jsonb
language sql
security definer
set search_path = public, vault
as $$
  select jsonb_build_object(
    'client_id', (select decrypted_secret from vault.decrypted_secrets where name = 'google_oauth_client_id'),
    'client_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'google_oauth_client_secret')
  );
$$;
revoke execute on function get_google_oauth_credentials() from public;
grant execute on function get_google_oauth_credentials() to service_role;
