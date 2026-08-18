// Hand-written types mirroring migrations/0001_init.sql.
// Regenerate/extend as the schema evolves (or swap for `supabase gen types typescript`).
//
// NOTE: these are declared with `type`, not `interface`. Supabase's generic
// helpers structurally check each table's Row against `Record<string, unknown>`;
// `interface` declarations don't get an implicit index signature in that check
// and silently fail it, which collapses the whole client to `never` types.

export type Role = "owner" | "admin";
export type CampaignStatus = "draft" | "active" | "paused" | "done";
export type ContentType = "post" | "carousel" | "reels" | "story";
export type ContentStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected";
export type MessageType = "dm" | "comment";
export type MessageClassification = "simple" | "complex";
export type MessageStatus = "new" | "auto_replied" | "escalated" | "answered" | "ignored";
export type ReviewStatus = "new" | "draft_ready" | "awaiting_approval" | "answered" | "skipped";

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  languages: string[];
  is_paused: boolean;
  paused_reason: string | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RestaurantUser = {
  id: string;
  restaurant_id: string;
  telegram_user_id: number;
  role: Role;
  display_name: string | null;
  created_at: string;
};

export type BrandContext = {
  id: string;
  restaurant_id: string;
  name: string | null;
  short_description: string | null;
  concept: string | null;
  philosophy: string | null;
  brand_values: string | null;
  voice_tone: string | null;
  voice_examples_do: string[];
  voice_examples_dont: string[];
  target_audience: string | null;
  flagship_items: unknown[];
  regular_events: unknown[];
  content_languages: Record<string, unknown>;
  taboo_topics: string[];
  reference_posts: unknown[];
  updated_by: number | null;
  created_at: string;
  updated_at: string;
};

export type InfoFaq = {
  id: string;
  restaurant_id: string;
  category: string;
  question: string;
  answer: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: string;
  restaurant_id: string;
  name: string;
  brief: string | null;
  goal: string | null;
  key_messages: string[];
  start_date: string | null;
  end_date: string | null;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
};

export type Asset = {
  id: string;
  restaurant_id: string;
  drive_file_id: string;
  drive_url: string | null;
  media_type: "photo" | "video";
  tags: string[];
  description: string | null;
  quality_score: number | null;
  is_used: boolean;
  created_at: string;
  updated_at: string;
};

export type ContentItem = {
  id: string;
  restaurant_id: string;
  campaign_id: string | null;
  type: ContentType;
  platforms: string[];
  caption: string | null;
  hashtags: string[];
  asset_ids: string[];
  status: ContentStatus;
  scheduled_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type Publication = {
  id: string;
  restaurant_id: string;
  content_item_id: string;
  platform: string;
  external_post_id: string | null;
  published_at: string | null;
  result: "success" | "failed";
  error_message: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  restaurant_id: string;
  platform: string;
  external_message_id: string | null;
  author_name: string | null;
  author_external_id: string | null;
  text: string | null;
  message_type: MessageType;
  classification: MessageClassification | null;
  status: MessageStatus;
  draft_reply: string | null;
  escalated_to: number | null;
  received_at: string;
  replied_at: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  restaurant_id: string;
  source: string;
  external_review_id: string | null;
  author_name: string | null;
  rating: number | null;
  text: string | null;
  draft_reply: string | null;
  status: ReviewStatus;
  received_at: string;
  replied_at: string | null;
  created_at: string;
};

export type ActivityLogEntry = {
  id: string;
  restaurant_id: string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type Settings = {
  id: string;
  restaurant_id: string;
  posting_slots: Record<string, string[]>;
  auto_reply_enabled: boolean;
  daily_cycle_time: string;
  inbox_check_interval_minutes: number;
  reviews_check_interval_minutes: number;
  alert_mode: boolean;
  created_at: string;
  updated_at: string;
};

// Minimal Supabase Database shape (only `public` schema, row types only).
// Insert/Update types default to Partial<Row> which is permissive but keeps
// the client usable without hand-maintaining three variants per table.
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      restaurants: Table<Restaurant>;
      restaurant_users: Table<RestaurantUser>;
      brand_context: Table<BrandContext>;
      info_faq: Table<InfoFaq>;
      campaigns: Table<Campaign>;
      assets: Table<Asset>;
      content_items: Table<ContentItem>;
      publications: Table<Publication>;
      messages: Table<Message>;
      reviews: Table<Review>;
      activity_log: Table<ActivityLogEntry>;
      settings: Table<Settings>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
