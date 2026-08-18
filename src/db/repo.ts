import { getSupabase } from "./client.js";
import type { Restaurant, RestaurantUser, Role, Settings } from "../types/database.js";

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  const { data, error } = await getSupabase()
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRestaurantUsers(restaurantId: string): Promise<RestaurantUser[]> {
  const { data, error } = await getSupabase()
    .from("restaurant_users")
    .select("*")
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
  return data ?? [];
}

export async function findRestaurantUser(
  restaurantId: string,
  telegramUserId: number
): Promise<RestaurantUser | null> {
  const { data, error } = await getSupabase()
    .from("restaurant_users")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createRestaurantUser(
  restaurantId: string,
  telegramUserId: number,
  role: Role,
  displayName: string | null
): Promise<RestaurantUser> {
  const { data, error } = await getSupabase()
    .from("restaurant_users")
    .insert({
      restaurant_id: restaurantId,
      telegram_user_id: telegramUserId,
      role,
      display_name: displayName,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setRestaurantPaused(
  restaurantId: string,
  paused: boolean,
  reason: string | null
): Promise<Restaurant> {
  const { data, error } = await getSupabase()
    .from("restaurants")
    .update({
      is_paused: paused,
      paused_reason: paused ? reason : null,
      paused_at: paused ? new Date().toISOString() : null,
    })
    .eq("id", restaurantId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getSettings(restaurantId: string): Promise<Settings | null> {
  const { data, error } = await getSupabase()
    .from("settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function logActivity(
  restaurantId: string,
  actor: string,
  action: string,
  details: Record<string, unknown> = {},
  entityType: string | null = null,
  entityId: string | null = null
): Promise<void> {
  const { error } = await getSupabase().from("activity_log").insert({
    restaurant_id: restaurantId,
    actor,
    action,
    details,
    entity_type: entityType,
    entity_id: entityId,
  });
  if (error) throw error;
}
