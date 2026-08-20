import { createClient } from "@supabase/supabase-js";

// Publishable (anon) URL/key — safe to ship in a client bundle by design.
// Every table these touch is protected by RLS (see migrations/0001_init.sql);
// nothing here can read or write beyond what the signed-in user is a member of.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — copy .env.example to .env and fill them in " +
      "(see README for how to set up a Supabase project).",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const ATTACHMENTS_BUCKET = "attachments";
