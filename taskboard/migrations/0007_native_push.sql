-- Native push (APNs via Capacitor) alongside the existing Web Push. Device
-- tokens are structurally different from Web Push subscriptions (a single
-- opaque token, not endpoint/p256dh/auth_key), so this is a new table
-- rather than reusing push_subscriptions.
--
-- Before send-push can deliver to iOS you must also seed an APNs auth key
-- in Vault (SQL Editor) — never commit its value to git:
--
--   select vault.create_secret('<contents of your .p8 auth key file>', 'apns_auth_key');
--   select vault.create_secret('<APNs key id>', 'apns_key_id');
--   select vault.create_secret('<Apple team id>', 'apns_team_id');
--   select vault.create_secret('com.ivchenkohub.app', 'apns_bundle_id');
--
-- Generate the .p8 key in App Store Connect → Certificates, Identifiers &
-- Profiles → Keys, with the "Apple Push Notifications service" capability.

create table native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
create index idx_native_push_tokens_user on native_push_tokens(user_id);
alter table native_push_tokens enable row level security;

create policy native_push_tokens_own on native_push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Mirrors get_subscriptions_for_target (0003) for native tokens.
create or replace function get_native_tokens_for_target(p_card_id uuid, p_target_user_id uuid)
returns table (platform text, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board_id uuid;
begin
  select board_id into v_board_id from cards where id = p_card_id;
  if v_board_id is null then
    return;
  end if;
  if not is_board_member(v_board_id) then
    raise exception 'not a member of this card''s board';
  end if;
  if not exists (
    select 1 from board_members where board_id = v_board_id and user_id = p_target_user_id
  ) then
    raise exception 'target user is not a member of this board';
  end if;

  return query
    select npt.platform, npt.token
    from native_push_tokens npt
    where npt.user_id = p_target_user_id;
end;
$$;
revoke execute on function get_native_tokens_for_target(uuid, uuid) from public;
grant execute on function get_native_tokens_for_target(uuid, uuid) to authenticated;

-- Called by the due-reminders cron job (mirrors get_subscriptions_for_target's
-- use there) — no card to scope by, so just every token for the user.
create or replace function get_native_tokens_for_user(p_user_id uuid)
returns table (platform text, token text)
language sql
security definer
set search_path = public
as $$
  select platform, token from native_push_tokens where user_id = p_user_id;
$$;
revoke execute on function get_native_tokens_for_user(uuid) from public;
grant execute on function get_native_tokens_for_user(uuid) to service_role;

-- Called by the send-push/due-reminders edge functions to read the APNs
-- auth key out of Vault. Never exposed to normal clients.
create or replace function get_apns_config()
returns jsonb
language sql
security definer
set search_path = public, vault
as $$
  select jsonb_build_object(
    'auth_key', (select decrypted_secret from vault.decrypted_secrets where name = 'apns_auth_key'),
    'key_id', (select decrypted_secret from vault.decrypted_secrets where name = 'apns_key_id'),
    'team_id', (select decrypted_secret from vault.decrypted_secrets where name = 'apns_team_id'),
    'bundle_id', (select decrypted_secret from vault.decrypted_secrets where name = 'apns_bundle_id')
  );
$$;
revoke execute on function get_apns_config() from public;
grant execute on function get_apns_config() to service_role;
