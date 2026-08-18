-- Hedonist AI-marketer: initial multi-tenant schema (Phase 0)
-- Every table except `restaurants` carries restaurant_id for tenant isolation.
-- Target: Postgres via Supabase. Run with `npm run migrate` or paste into the SQL editor.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- restaurants: tenants
-- ---------------------------------------------------------------------------
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null default 'Europe/Kyiv',
  languages text[] not null default array['uk', 'en'],
  is_paused boolean not null default false, -- "стоп-кран"
  paused_reason text,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_restaurants_updated_at before update on restaurants
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- restaurant_users: owners/admins mapped to Telegram accounts
-- ---------------------------------------------------------------------------
create table restaurant_users (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  telegram_user_id bigint not null,
  role text not null check (role in ('owner', 'admin')),
  display_name text,
  created_at timestamptz not null default now(),
  unique (restaurant_id, telegram_user_id)
);
create index idx_restaurant_users_restaurant on restaurant_users(restaurant_id);
create index idx_restaurant_users_telegram on restaurant_users(telegram_user_id);

-- ---------------------------------------------------------------------------
-- brand_context: permanent brand knowledge base (section 8.1)
-- ---------------------------------------------------------------------------
create table brand_context (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references restaurants(id) on delete cascade,
  name text,
  short_description text,
  concept text,
  philosophy text,
  brand_values text,
  voice_tone text,
  voice_examples_do text[] not null default '{}',
  voice_examples_dont text[] not null default '{}',
  target_audience text,
  flagship_items jsonb not null default '[]', -- [{name, description, priority}]
  regular_events jsonb not null default '[]', -- [{name, schedule, description}]
  content_languages jsonb not null default '{}', -- {primary, secondary}
  taboo_topics text[] not null default '{}',
  reference_posts jsonb not null default '[]',
  updated_by bigint, -- telegram_user_id of last editor
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_brand_context_updated_at before update on brand_context
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- info_faq: factual layer used for auto-replies
-- ---------------------------------------------------------------------------
create table info_faq (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  category text not null, -- hours | address | reservation | menu | faq | other
  question text not null,
  answer text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, category, question)
);
create index idx_info_faq_restaurant on info_faq(restaurant_id);
create trigger trg_info_faq_updated_at before update on info_faq
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  brief text,
  goal text,
  key_messages text[] not null default '{}',
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_campaigns_restaurant on campaigns(restaurant_id);
create index idx_campaigns_status on campaigns(restaurant_id, status);
create trigger trg_campaigns_updated_at before update on campaigns
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- assets: Google Drive photo/video inventory
-- ---------------------------------------------------------------------------
create table assets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  drive_file_id text not null,
  drive_url text,
  media_type text not null default 'photo' check (media_type in ('photo', 'video')),
  tags text[] not null default '{}',
  description text, -- vision analysis summary
  quality_score numeric,
  is_used boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, drive_file_id)
);
create index idx_assets_restaurant on assets(restaurant_id);
create index idx_assets_unused on assets(restaurant_id, is_used);
create trigger trg_assets_updated_at before update on assets
  for each row execute function set_updated_at();

-- join table: which assets a campaign was seeded with
create table campaign_assets (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  primary key (campaign_id, asset_id)
);

-- ---------------------------------------------------------------------------
-- content_items: the approval/publishing queue
-- ---------------------------------------------------------------------------
create table content_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  type text not null check (type in ('post', 'carousel', 'reels', 'story')),
  platforms text[] not null default '{}', -- instagram | facebook | google_business
  caption text,
  hashtags text[] not null default '{}',
  asset_ids uuid[] not null default '{}', -- ordered references into assets(id)
  status text not null default 'draft'
    check (status in ('draft', 'awaiting_approval', 'approved', 'scheduled', 'published', 'rejected')),
  scheduled_at timestamptz,
  approved_by bigint, -- telegram_user_id
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_content_items_restaurant on content_items(restaurant_id);
create index idx_content_items_status on content_items(restaurant_id, status);
create index idx_content_items_campaign on content_items(campaign_id);
create trigger trg_content_items_updated_at before update on content_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- publications: record of what actually went out
-- ---------------------------------------------------------------------------
create table publications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  content_item_id uuid not null references content_items(id) on delete cascade,
  platform text not null,
  external_post_id text,
  published_at timestamptz,
  result text not null default 'success' check (result in ('success', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);
create index idx_publications_restaurant on publications(restaurant_id);
create index idx_publications_content_item on publications(content_item_id);

-- ---------------------------------------------------------------------------
-- messages: inbox (DMs + comments)
-- ---------------------------------------------------------------------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  platform text not null, -- instagram | facebook
  external_message_id text,
  author_name text,
  author_external_id text,
  text text,
  message_type text not null check (message_type in ('dm', 'comment')),
  classification text check (classification in ('simple', 'complex')),
  status text not null default 'new'
    check (status in ('new', 'auto_replied', 'escalated', 'answered', 'ignored')),
  draft_reply text,
  escalated_to bigint, -- telegram_user_id of admin notified
  received_at timestamptz not null default now(),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (restaurant_id, platform, external_message_id)
);
create index idx_messages_restaurant on messages(restaurant_id);
create index idx_messages_status on messages(restaurant_id, status);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  source text not null, -- google | tripadvisor | other
  external_review_id text,
  author_name text,
  rating int,
  text text,
  draft_reply text,
  status text not null default 'new'
    check (status in ('new', 'draft_ready', 'awaiting_approval', 'answered', 'skipped')),
  received_at timestamptz not null default now(),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (restaurant_id, source, external_review_id)
);
create index idx_reviews_restaurant on reviews(restaurant_id);
create index idx_reviews_status on reviews(restaurant_id, status);

-- ---------------------------------------------------------------------------
-- activity_log: audit trail of everything the system does
-- ---------------------------------------------------------------------------
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  actor text not null, -- 'system' | telegram_user_id as text | etc.
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_activity_log_restaurant on activity_log(restaurant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- settings: per-tenant configuration
-- ---------------------------------------------------------------------------
create table settings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references restaurants(id) on delete cascade,
  posting_slots jsonb not null default '{}', -- e.g. {"wed": ["19:00"], "fri": ["20:00"], "sat": ["20:00"]}
  auto_reply_enabled boolean not null default true,
  daily_cycle_time time not null default '09:00',
  inbox_check_interval_minutes int not null default 30,
  reviews_check_interval_minutes int not null default 120,
  alert_mode boolean not null default false, -- "тревожный период": everything requires manual approval
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_settings_updated_at before update on settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: enabled tenant-wide; the bot/backend uses the Supabase
-- service role key (bypasses RLS) so no per-tenant policies are required yet.
-- Add scoped policies here once client-side/dashboard access is introduced.
-- ---------------------------------------------------------------------------
alter table restaurants enable row level security;
alter table restaurant_users enable row level security;
alter table brand_context enable row level security;
alter table info_faq enable row level security;
alter table campaigns enable row level security;
alter table assets enable row level security;
alter table campaign_assets enable row level security;
alter table content_items enable row level security;
alter table publications enable row level security;
alter table messages enable row level security;
alter table reviews enable row level security;
alter table activity_log enable row level security;
alter table settings enable row level security;
