import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session) supabase.rpc("accept_pending_board_invites");
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Cheap and idempotent — turns any pending board_invites row
      // matching this account's email into real board membership (see
      // migrations/0009_board_invites.sql).
      if (event === "SIGNED_IN") supabase.rpc("accept_pending_board_invites");
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}
