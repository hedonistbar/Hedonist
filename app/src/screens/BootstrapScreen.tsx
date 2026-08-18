import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { DEFAULT_RESTAURANT_SLUG, supabase } from "../lib/supabase";
import type { Restaurant } from "../lib/database.types";

export function BootstrapScreen({
  user,
  restaurant,
  onClaimed,
}: {
  user: User;
  restaurant: Restaurant | null;
  onClaimed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askedOwner, setAskedOwner] = useState(false);

  async function claimOwner() {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("claim_restaurant_owner", {
      p_slug: DEFAULT_RESTAURANT_SLUG,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      setAskedOwner(true);
      return;
    }
    onClaimed();
  }

  return (
    <div className="center-screen">
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <h2>{restaurant ? restaurant.name : "Заклад не знайдено"}</h2>
        <p className="sub">Ваш акаунт ({user.email}) ще не підключено до цього закладу.</p>

        {!restaurant ? (
          <div className="error-text">
            Ресторан "{DEFAULT_RESTAURANT_SLUG}" відсутній у базі — спочатку виконайте сідінг (npm run
            seed).
          </div>
        ) : askedOwner ? (
          <div className="notice">
            Схоже, у закладу вже є власник. Попросіть його додати вас — ваш email:{" "}
            <strong>{user.email}</strong>. Власник додає команду на вкладці «Команда».
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 16 }}>
              Якщо ви відкриваєте застосунок вперше і власника ще нема — станьте ним. Якщо власник вже
              є — попросіть додати ваш email.
            </p>
            {error && (
              <div className="error-text" style={{ marginBottom: 14 }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary" onClick={claimOwner} disabled={busy}>
              {busy ? "Хвилинку…" : "Я власник, підключити"}
            </button>
          </>
        )}

        <button
          className="link-btn"
          style={{ marginTop: 14 }}
          onClick={() => supabase.auth.signOut()}
        >
          Вийти
        </button>
      </div>
    </div>
  );
}
