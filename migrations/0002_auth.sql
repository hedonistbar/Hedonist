-- Adds Supabase Auth-based identity so the web app can talk to the database
-- directly from the browser (publishable/anon key) instead of through a
-- backend holding the service_role key. telegram_user_id becomes optional;
-- user_id (auth.users) becomes the primary identity going forward.

alter table restaurant_users
  add column user_id uuid references auth.users(id) on delete cascade;

alter table restaurant_users
  alter column telegram_user_id drop not null;

alter table restaurant_users
  add constraint restaurant_users_has_identity
  check (telegram_user_id is not null or user_id is not null);

alter table restaurant_users
  add constraint restaurant_users_restaurant_id_user_id_key unique (restaurant_id, user_id);

create index idx_restaurant_users_user on restaurant_users(user_id);

-- ---------------------------------------------------------------------------
-- Membership helpers, used by RLS policies below. SECURITY DEFINER with a
-- pinned search_path avoids RLS-recursion edge cases when one policy's check
-- queries a table that itself has RLS enabled.
-- ---------------------------------------------------------------------------
create or replace function is_restaurant_member(p_restaurant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from restaurant_users
    where restaurant_id = p_restaurant_id and user_id = auth.uid()
  );
$$;

create or replace function is_restaurant_owner(p_restaurant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from restaurant_users
    where restaurant_id = p_restaurant_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function is_restaurant_owner_or_admin(p_restaurant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from restaurant_users
    where restaurant_id = p_restaurant_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS policies for client-side (publishable-key) access.
-- Tables not yet used by the app (brand_context, info_faq, campaigns, assets,
-- content_items, publications, messages, reviews) stay RLS-enabled with no
-- policies, i.e. default-deny, until a screen actually needs them.
-- ---------------------------------------------------------------------------
create policy restaurants_select_members on restaurants
  for select using (is_restaurant_member(id));

create policy restaurants_update_owner_or_admin on restaurants
  for update using (is_restaurant_owner_or_admin(id));

create policy restaurant_users_select_own_or_team on restaurant_users
  for select using (user_id = auth.uid() or is_restaurant_owner_or_admin(restaurant_id));

create policy restaurant_users_insert_owner_only on restaurant_users
  for insert with check (is_restaurant_owner(restaurant_id));

create policy settings_select_members on settings
  for select using (is_restaurant_member(restaurant_id));

create policy settings_update_owner_or_admin on settings
  for update using (is_restaurant_owner_or_admin(restaurant_id));

create policy activity_log_select_members on activity_log
  for select using (is_restaurant_member(restaurant_id));

create policy activity_log_insert_members on activity_log
  for insert with check (is_restaurant_member(restaurant_id));

-- ---------------------------------------------------------------------------
-- RPCs: privileged operations the client can't do directly via RLS.
-- ---------------------------------------------------------------------------

-- First authenticated user to call this for a given restaurant becomes its
-- owner. Mirrors the bot's bootstrap-as-owner behavior from Phase 0.
create or replace function claim_restaurant_owner(p_slug text)
returns restaurant_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_existing restaurant_users;
  v_new restaurant_users;
begin
  select id into v_restaurant_id from restaurants where slug = p_slug;
  if v_restaurant_id is null then
    raise exception 'restaurant % not found', p_slug;
  end if;

  select * into v_existing from restaurant_users
    where restaurant_id = v_restaurant_id and user_id = auth.uid();
  if found then
    return v_existing;
  end if;

  if exists (select 1 from restaurant_users where restaurant_id = v_restaurant_id) then
    raise exception 'restaurant already has an owner; ask them to add you as admin';
  end if;

  insert into restaurant_users (restaurant_id, user_id, role, display_name)
  values (v_restaurant_id, auth.uid(), 'owner', (select email from auth.users where id = auth.uid()))
  returning * into v_new;

  insert into activity_log (restaurant_id, actor, action, details)
  values (v_restaurant_id, auth.uid()::text, 'owner_registered', '{}'::jsonb);

  return v_new;
end;
$$;

-- Owner adds an admin by email. The target must already have an account
-- (auth.users isn't readable by clients directly, hence security definer).
create or replace function add_admin_by_email(
  p_restaurant_id uuid,
  p_email text,
  p_display_name text default null
)
returns restaurant_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user_id uuid;
  v_new restaurant_users;
begin
  if not is_restaurant_owner(p_restaurant_id) then
    raise exception 'only the owner can add administrators';
  end if;

  select id into v_target_user_id from auth.users where lower(email) = lower(p_email);
  if v_target_user_id is null then
    raise exception 'no account found for %; ask them to sign up first', p_email;
  end if;

  if exists (
    select 1 from restaurant_users
    where restaurant_id = p_restaurant_id and user_id = v_target_user_id
  ) then
    raise exception '% is already a member', p_email;
  end if;

  insert into restaurant_users (restaurant_id, user_id, role, display_name)
  values (p_restaurant_id, v_target_user_id, 'admin', coalesce(p_display_name, p_email))
  returning * into v_new;

  insert into activity_log (restaurant_id, actor, action, details)
  values (p_restaurant_id, auth.uid()::text, 'admin_added', jsonb_build_object('email', p_email));

  return v_new;
end;
$$;
