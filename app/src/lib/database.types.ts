// Hand-written subset of the schema this app actually touches. See
// ../../../src/types/database.ts for the full backend-side model; kept
// separate because the app only needs a slice of it and pulls in Auth-era
// fields (user_id) that the bot-side types don't have yet.

export type Role = "owner" | "admin";

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
  telegram_user_id: number | null;
  user_id: string | null;
  role: Role;
  display_name: string | null;
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

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type Fn<Args, Returns> = {
  Args: Args;
  Returns: Returns;
};

export type Database = {
  public: {
    Tables: {
      restaurants: Table<Restaurant>;
      restaurant_users: Table<RestaurantUser>;
      settings: Table<Settings>;
      activity_log: Table<ActivityLogEntry>;
    };
    Views: Record<string, never>;
    Functions: {
      claim_restaurant_owner: Fn<{ p_slug: string }, RestaurantUser>;
      add_admin_by_email: Fn<
        { p_restaurant_id: string; p_email: string; p_display_name?: string | null },
        RestaurantUser
      >;
    };
  };
};
