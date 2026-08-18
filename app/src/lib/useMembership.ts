import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { DEFAULT_RESTAURANT_SLUG, supabase } from "./supabase";
import type { Restaurant, RestaurantUser } from "./database.types";

type MembershipState = {
  loading: boolean;
  restaurant: Restaurant | null;
  membership: RestaurantUser | null;
  error: string | null;
  refresh: () => void;
};

export function useMembership(user: User | null): MembershipState {
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [membership, setMembership] = useState<RestaurantUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: restaurantRow, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("slug", DEFAULT_RESTAURANT_SLUG)
        .maybeSingle();

      if (cancelled) return;
      if (restaurantError) {
        setError(restaurantError.message);
        setLoading(false);
        return;
      }
      setRestaurant(restaurantRow);

      if (!restaurantRow || !user) {
        setMembership(null);
        setLoading(false);
        return;
      }

      // RLS lets a member see their own row, or the whole team once they're
      // owner/admin. An unauthenticated-for-this-restaurant user just sees
      // nothing back here (not an error) — that's how we detect "not yet a member".
      const { data: rows, error: usersError } = await supabase
        .from("restaurant_users")
        .select("*")
        .eq("restaurant_id", restaurantRow.id);

      if (cancelled) return;
      if (usersError) {
        setError(usersError.message);
        setLoading(false);
        return;
      }

      const mine = (rows ?? []).find((r) => r.user_id === user.id) ?? null;
      setMembership(mine);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  return { loading, restaurant, membership, error, refresh };
}
