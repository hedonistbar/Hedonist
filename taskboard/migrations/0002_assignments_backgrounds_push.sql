-- Card assignment, board backgrounds, and Web Push subscriptions.

alter table cards add column assigned_to uuid references auth.users(id) on delete set null;
alter table cards add column due_notified_at timestamptz;
create index idx_cards_assigned_to on cards(assigned_to);

-- Board backgrounds: an id from src/lib/backgrounds.ts (a fixed preset
-- palette, not arbitrary CSS or uploaded images), null = default.
alter table boards add column background text;

-- Push notification subscriptions (Web Push). One row per browser/device
-- the user has enabled notifications on.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
create index idx_push_subscriptions_user on push_subscriptions(user_id);
alter table push_subscriptions enable row level security;

create policy push_subscriptions_own on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- assigned_to/background are meaningful board data like any other column:
-- the existing cards_all_members / boards RLS policies already cover them.
