import { createClient } from "@supabase/supabase-js";

// Publishable (anon) URL/key — safe to ship in a client bundle by design.
// Every table these touch is protected by RLS (see migrations/0001_init.sql);
// nothing here can read or write beyond what the signed-in user is a member of.
// Falls back to the pilot taskboard project's public values (also safe to
// expose) so the app works out of the box; override via .env to point at a
// different Supabase project.
// `||` (not `??`) on purpose: an unset build-time env var can come through
// as an empty string rather than undefined (e.g. a GitHub Actions secret
// that doesn't exist evaluates to ""), which `??` wouldn't fall back on.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://yihpqinsjcaknxngnssp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_n_GmzQ7IVD-tk-0iIjrdWw_JV5nBepu";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const ATTACHMENTS_BUCKET = "attachments";
