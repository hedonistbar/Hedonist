-- RPCs used by the Edge Functions in supabase/functions/. Run this after
-- 0002. Before either edge function will work you must also seed three
-- Vault secrets (SQL Editor, or the Supabase dashboard's Vault UI) — never
-- commit their values to git:
--
--   select vault.create_secret('<your VAPID public key>', 'vapid_public_key');
--   select vault.create_secret('<your VAPID private key>', 'vapid_private_key');
--   select vault.create_secret('mailto:you@example.com', 'vapid_subject');
--   select vault.create_secret('<a random string>', 'cron_shared_secret');
--
-- Generate a VAPID key pair with `npx web-push generate-vapid-keys`.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Called by edge functions (with the service role key) to read VAPID
-- config out of Vault. Never exposed to normal clients.
create or replace function get_vapid_keys()
returns jsonb
language sql
security definer
set search_path = public, vault
as $$
  select jsonb_build_object(
    'public_key', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
    'private_key', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
    'subject', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_subject')
  );
$$;
revoke execute on function get_vapid_keys() from public;
grant execute on function get_vapid_keys() to service_role;

-- Called by the due-reminders cron job (see 0004) to authenticate itself
-- to the edge function without a user JWT.
create or replace function get_cron_secret()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cron_shared_secret';
$$;
revoke execute on function get_cron_secret() from public;
grant execute on function get_cron_secret() to service_role;

-- Called by the send-push edge function (forwarding the caller's own JWT,
-- anon key) when a card gets assigned to someone. Lets the caller fetch the
-- *target's* push subscriptions — which their own RLS on push_subscriptions
-- wouldn't allow — but only once we've verified both the caller and the
-- target are members of the same board as the card in question.
create or replace function get_subscriptions_for_target(p_card_id uuid, p_target_user_id uuid)
returns table (endpoint text, p256dh text, auth_key text)
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
    select ps.endpoint, ps.p256dh, ps.auth_key
    from push_subscriptions ps
    where ps.user_id = p_target_user_id;
end;
$$;
revoke execute on function get_subscriptions_for_target(uuid, uuid) from public;
grant execute on function get_subscriptions_for_target(uuid, uuid) to authenticated;
