import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// These are the Supabase *publishable* (anon) URL/key — safe to ship in a
// client bundle by design. Every table these touch is protected by RLS
// (see migrations/0002_auth.sql); nothing here can read or write beyond
// what the signed-in user is a member of.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://lablqtvixsczspczsogx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_kjMSz2yYfBt0KKwiRURLeg_8-vnPQ0z";

export const DEFAULT_RESTAURANT_SLUG = import.meta.env.VITE_DEFAULT_RESTAURANT_SLUG ?? "hedonist";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
