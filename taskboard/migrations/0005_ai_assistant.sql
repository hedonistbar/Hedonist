-- AI assistant inside each card: chat history + a self-service way to store
-- the shared Anthropic API key in Vault (no manual SQL needed after this —
-- the app's new "ИИ" settings screen calls set_anthropic_api_key() itself).
-- Run after 0004. Requires migrations/0001-0004 already applied.

-- ---------------------------------------------------------------------------
-- ai_messages: chat history per card. role 'user' = the person typing,
-- 'assistant' = Claude's reply. Same board-membership RLS pattern as
-- checklist_items/attachments.
-- ---------------------------------------------------------------------------
create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_ai_messages_card on ai_messages(card_id, created_at);
alter table ai_messages enable row level security;

create policy ai_messages_all_members on ai_messages
  for all using (is_board_member(board_id)) with check (is_board_member(board_id));

-- ---------------------------------------------------------------------------
-- Anthropic API key, shared across the whole app (like the VAPID keys) —
-- stored once via Vault through the RPC below, never in a table or in git.
-- ---------------------------------------------------------------------------

-- Called by any signed-in member from the new "ИИ" settings screen to save
-- (or replace) the shared key. Upserts by name since vault.create_secret
-- requires a unique name.
create or replace function set_anthropic_api_key(p_key text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_key), '') = '' then
    raise exception 'key must not be empty';
  end if;

  select id into v_id from vault.secrets where name = 'anthropic_api_key';
  if v_id is null then
    perform vault.create_secret(p_key, 'anthropic_api_key');
  else
    perform vault.update_secret(v_id, p_key);
  end if;
end;
$$;
revoke execute on function set_anthropic_api_key(text) from public;
grant execute on function set_anthropic_api_key(text) to authenticated;

-- Lets the settings screen show "key set" / "key not set" without ever
-- exposing the key value itself to the client.
create or replace function has_anthropic_api_key()
returns boolean
language sql
security definer
set search_path = public, vault
stable
as $$
  select exists (select 1 from vault.secrets where name = 'anthropic_api_key');
$$;
revoke execute on function has_anthropic_api_key() from public;
grant execute on function has_anthropic_api_key() to authenticated;

-- Called by the ai-chat edge function (service role only) to read the key
-- out of Vault when calling the Anthropic API.
create or replace function get_anthropic_api_key()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'anthropic_api_key';
$$;
revoke execute on function get_anthropic_api_key() from public;
grant execute on function get_anthropic_api_key() to service_role;
