-- Small helper the invite-board-member edge function uses (via the
-- service-role client) to decide whether an invited email already has an
-- account, without relying on fragile error-message matching against
-- auth.admin.inviteUserByEmail's response.
create or replace function find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function find_user_id_by_email(text) from public;
grant execute on function find_user_id_by_email(text) to authenticated, service_role;
