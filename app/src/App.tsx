import { useState } from "react";
import "./App.css";
import { useAuth } from "./lib/useAuth";
import { useMembership } from "./lib/useMembership";
import { supabase } from "./lib/supabase";
import { AuthScreen } from "./screens/AuthScreen";
import { BootstrapScreen } from "./screens/BootstrapScreen";
import { StatusScreen } from "./screens/StatusScreen";
import { TeamScreen } from "./screens/TeamScreen";
import type { Restaurant } from "./lib/database.types";

function roleLabel(role: "owner" | "admin") {
  return role === "owner" ? "власник" : "адміністратор";
}

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { loading: memberLoading, restaurant, membership, error, refresh } = useMembership(user);
  const [tab, setTab] = useState<"status" | "team">("status");
  const [restaurantOverride, setRestaurantOverride] = useState<Restaurant | null>(null);

  if (authLoading || (user && memberLoading)) {
    return <div className="spinner-screen">Завантаження…</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (error) {
    return (
      <div className="center-screen">
        <div className="error-text">{error}</div>
      </div>
    );
  }

  if (!membership) {
    return <BootstrapScreen user={user} restaurant={restaurant} onClaimed={refresh} />;
  }

  const activeRestaurant = restaurantOverride ?? restaurant!;

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <span className="eyebrow">HEDONIST · AI-МАРКЕТОЛОГ</span>
          <h1>{activeRestaurant.name}</h1>
        </div>
        <button className="icon-btn" onClick={() => supabase.auth.signOut()}>
          Вийти
        </button>
      </div>

      <main className="content">
        <span className={`pill ${membership.role}`} style={{ alignSelf: "flex-start" }}>
          {roleLabel(membership.role)}
        </span>

        {tab === "status" ? (
          <StatusScreen
            restaurant={activeRestaurant}
            membership={membership}
            onRestaurantChange={setRestaurantOverride}
          />
        ) : (
          <TeamScreen restaurant={activeRestaurant} membership={membership} />
        )}
      </main>

      <div className="tabbar">
        <button className={tab === "status" ? "active" : ""} onClick={() => setTab("status")}>
          Статус
        </button>
        <button className={tab === "team" ? "active" : ""} onClick={() => setTab("team")}>
          Команда
        </button>
      </div>
    </div>
  );
}
