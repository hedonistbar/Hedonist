-- Taskboard: personal Trello-like task manager. Own Supabase project,
-- separate from Hedonist's. Run via SQL Editor, in order.
--
-- Every table except `boards` carries board_id for board-scoped isolation.
-- The browser talks to Postgres directly with the publishable (anon) key —
-- everything is protected by Row Level Security, no backend required.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- boards
-- ---------------------------------------------------------------------------
create table boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_boards_updated_at before update on boards
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- board_members: who can see/edit a board. 'owner' can rename/delete the
-- board and manage members; 'member' can do everything else (lists, cards,
-- checklists, attachments) — this is what lets you share a board with your
-- spouse.
-- ---------------------------------------------------------------------------
create table board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  display_name text,
  created_at timestamptz not null default now(),
  unique (board_id, user_id)
);
create index idx_board_members_board on board_members(board_id);
create index idx_board_members_user on board_members(user_id);

-- ---------------------------------------------------------------------------
-- lists: columns within a board (e.g. To Do / Doing / Done)
-- ---------------------------------------------------------------------------
create table lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  title text not null,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_lists_board on lists(board_id, position);
create trigger trg_lists_updated_at before update on lists
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- cards
-- ---------------------------------------------------------------------------
create table cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  list_id uuid not null references lists(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  is_done boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cards_board on cards(board_id);
create index idx_cards_list on cards(list_id, position);
create trigger trg_cards_updated_at before update on cards
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- checklist_items
-- ---------------------------------------------------------------------------
create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  text text not null,
  is_done boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index idx_checklist_items_card on checklist_items(card_id, position);

-- ---------------------------------------------------------------------------
-- attachments: metadata only — the file bytes live in Supabase Storage
-- bucket "attachments", at path `${board_id}/${card_id}/${uuid}-${filename}`.
-- ---------------------------------------------------------------------------
create table attachments (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_attachments_card on attachments(card_id);

alter table boards enable row level security;
alter table board_members enable row level security;
alter table lists enable row level security;
alter table cards enable row level security;
alter table checklist_items enable row level security;
alter table attachments enable row level security;

-- ---------------------------------------------------------------------------
-- Membership helpers, used by RLS policies below. SECURITY DEFINER with a
-- pinned search_path avoids RLS-recursion edge cases when one policy's check
-- queries a table that itself has RLS enabled.
-- ---------------------------------------------------------------------------
create or replace function is_board_member(p_board_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from board_members
    where board_id = p_board_id and user_id = auth.uid()
  );
$$;

create or replace function is_board_owner(p_board_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from board_members
    where board_id = p_board_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
create policy boards_select_members on boards
  for select using (is_board_member(id));

create policy boards_update_owner on boards
  for update using (is_board_owner(id));

create policy boards_delete_owner on boards
  for delete using (is_board_owner(id));

-- Board creation happens via create_board() below (security definer, also
-- inserts the owner's board_members row atomically), so no direct insert policy.

create policy board_members_select_fellow_members on board_members
  for select using (is_board_member(board_id));

create policy board_members_delete_self_or_owner on board_members
  for delete using (
    user_id = auth.uid() -- leave a board yourself
    or (is_board_owner(board_id) and role <> 'owner') -- owner removes a member
  );

create policy lists_all_members on lists
  for all using (is_board_member(board_id)) with check (is_board_member(board_id));

create policy cards_all_members on cards
  for all using (is_board_member(board_id)) with check (is_board_member(board_id));

create policy checklist_items_all_members on checklist_items
  for all using (is_board_member(board_id)) with check (is_board_member(board_id));

create policy attachments_all_members on attachments
  for all using (is_board_member(board_id)) with check (is_board_member(board_id));

-- ---------------------------------------------------------------------------
-- RPCs: privileged operations the client can't do directly via RLS.
-- ---------------------------------------------------------------------------

-- Creates a board and makes the caller its owner, atomically.
create or replace function create_board(p_name text)
returns boards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board boards;
begin
  insert into boards (owner_id, name) values (auth.uid(), p_name) returning * into v_board;

  insert into board_members (board_id, user_id, role, display_name)
  values (v_board.id, auth.uid(), 'owner', (select email from auth.users where id = auth.uid()));

  return v_board;
end;
$$;

-- Owner shares a board with another user by email. The target must already
-- have an account (auth.users isn't readable by clients directly, hence
-- security definer) — ask them to sign up first.
create or replace function share_board_by_email(p_board_id uuid, p_email text)
returns board_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user_id uuid;
  v_new board_members;
begin
  if not is_board_owner(p_board_id) then
    raise exception 'only the board owner can share it';
  end if;

  select id into v_target_user_id from auth.users where lower(email) = lower(p_email);
  if v_target_user_id is null then
    raise exception 'no account found for %; ask them to sign up first', p_email;
  end if;

  if exists (
    select 1 from board_members where board_id = p_board_id and user_id = v_target_user_id
  ) then
    raise exception '% is already on this board', p_email;
  end if;

  insert into board_members (board_id, user_id, role, display_name)
  values (p_board_id, v_target_user_id, 'member', p_email)
  returning * into v_new;

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: a private bucket for card attachments. Files live at
-- `${board_id}/${card_id}/${uuid}-${filename}`; RLS on storage.objects
-- checks board membership from the first path segment.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy attachments_storage_all_members on storage.objects
  for all
  using (bucket_id = 'attachments' and is_board_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'attachments' and is_board_member(((storage.foldername(name))[1])::uuid));
