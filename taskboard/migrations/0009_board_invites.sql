-- Board invites for not-yet-registered users, plus widening board
-- background/color updates to any board member (was owner-only, which
-- silently no-op'd for members since the client never checked the
-- update result — see BackgroundModal.tsx).

-- ---------------------------------------------------------------------------
-- board_invites: pending invites for an email that doesn't have an account
-- yet. Written only by the invite-board-member edge function (service
-- role), consumed by accept_pending_board_invites() on the invitee's first
-- sign-in after they complete Supabase's invite-email signup flow.
-- ---------------------------------------------------------------------------
-- email is always stored lower-cased by the writer (invite-board-member
-- edge function / accept_pending_board_invites' auth.users lookup), so a
-- plain column unique constraint is enough -- no expression index needed.
create table board_invites (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (board_id, email)
);
create index idx_board_invites_email on board_invites (email);
alter table board_invites enable row level security;

create policy board_invites_select_owner on board_invites
  for select using (is_board_owner(board_id));

create policy board_invites_delete_owner on board_invites
  for delete using (is_board_owner(board_id));
-- No insert/update policy: rows are only written by the service-role edge
-- function (invite-board-member), which bypasses RLS by design.

-- Called after sign-in; turns any pending invite matching the caller's
-- email into real board membership. Idempotent and cheap, safe to call on
-- every login.
create or replace function accept_pending_board_invites()
returns setof board_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_row board_invites;
  v_member board_members;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return;
  end if;

  for v_row in select * from board_invites where email = lower(v_email) loop
    v_member := null;
    insert into board_members (board_id, user_id, role, display_name)
    values (v_row.board_id, auth.uid(), 'member', v_email)
    on conflict (board_id, user_id) do nothing
    returning * into v_member;

    delete from board_invites where id = v_row.id;

    if v_member.id is not null then
      return next v_member;
    end if;
  end loop;
end;
$$;
revoke all on function accept_pending_board_invites() from public;
grant execute on function accept_pending_board_invites() to authenticated;

-- ---------------------------------------------------------------------------
-- Widen boards UPDATE to any member (background/color restyle), while
-- still enforcing rename/ownership-transfer as owner-only at the DB level.
-- ---------------------------------------------------------------------------
drop policy boards_update_owner on boards;
create policy boards_update_members on boards
  for update using (is_board_member(id)) with check (is_board_member(id));

create or replace function enforce_board_owner_only_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.name is distinct from old.name or new.owner_id is distinct from old.owner_id)
     and not is_board_owner(old.id) then
    raise exception 'only the board owner can rename or transfer this board';
  end if;
  return new;
end;
$$;
create trigger trg_boards_owner_only_fields
  before update on boards
  for each row execute function enforce_board_owner_only_fields();
