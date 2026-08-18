import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Restaurant, RestaurantUser, Settings } from "../lib/database.types";

export function StatusScreen({
  restaurant,
  membership,
  onRestaurantChange,
}: {
  restaurant: Restaurant;
  membership: RestaurantUser;
  onRestaurantChange: (r: Restaurant) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showReasonField, setShowReasonField] = useState(false);

  const canToggle = membership.role === "owner" || membership.role === "admin";

  useEffect(() => {
    supabase
      .from("settings")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle()
      .then(({ data }) => setSettings(data));
  }, [restaurant.id]);

  async function logAction(action: string, details: Record<string, unknown> = {}) {
    await supabase.from("activity_log").insert({
      restaurant_id: restaurant.id,
      actor: membership.user_id ?? "unknown",
      action,
      details,
    });
  }

  async function pause() {
    setBusy(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("restaurants")
      .update({ is_paused: true, paused_reason: reason || null, paused_at: new Date().toISOString() })
      .eq("id", restaurant.id)
      .select("*")
      .single();
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onRestaurantChange(data);
    setShowReasonField(false);
    setReason("");
    await logAction("stop_crane_activated", { reason: reason || null });
  }

  async function resume() {
    setBusy(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("restaurants")
      .update({ is_paused: false, paused_reason: null, paused_at: null })
      .eq("id", restaurant.id)
      .select("*")
      .single();
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onRestaurantChange(data);
    await logAction("stop_crane_deactivated");
  }

  return (
    <>
      <div className="card">
        <div className="status-hero">
          <span className={`status-dot ${restaurant.is_paused ? "paused" : "active"}`} />
          <span className="state-label">
            {restaurant.is_paused ? "Стоп-кран увімкнено" : "Працює в штатному режимі"}
          </span>
          <span className="state-detail">
            {restaurant.is_paused
              ? restaurant.paused_reason
                ? `Причина: ${restaurant.paused_reason}`
                : "Публікації та авто-відповіді зупинено."
              : "Публікації, чернетки та авто-відповіді йдуть за розкладом."}
          </span>
          {restaurant.is_paused && restaurant.paused_at && (
            <span className="mono" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              з {new Date(restaurant.paused_at).toLocaleString("uk-UA")}
            </span>
          )}
        </div>

        {error && <div className="error-text" style={{ marginBottom: 14 }}>{error}</div>}

        {!canToggle ? (
          <div className="notice">Тільки власник або адміністратор можуть керувати стоп-краном.</div>
        ) : restaurant.is_paused ? (
          <button className="btn btn-primary" onClick={resume} disabled={busy}>
            {busy ? "Хвилинку…" : "Зняти стоп-кран"}
          </button>
        ) : showReasonField ? (
          <>
            <div className="field">
              <label htmlFor="reason">Причина (необов'язково)</label>
              <input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Наприклад: перебій зі світлом"
              />
            </div>
            <button className="btn btn-danger" onClick={pause} disabled={busy}>
              {busy ? "Хвилинку…" : "Підтвердити паузу"}
            </button>
            <button
              className="link-btn"
              onClick={() => {
                setShowReasonField(false);
                setReason("");
              }}
            >
              Скасувати
            </button>
          </>
        ) : (
          <button className="btn btn-danger" onClick={() => setShowReasonField(true)} disabled={busy}>
            Увімкнути стоп-кран
          </button>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16 }}>Заклад</h2>
        <p className="sub" style={{ marginBottom: 12 }}>{restaurant.name}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5 }}>
          <Row label="Часовий пояс" value={restaurant.timezone} />
          <Row label="Мови" value={restaurant.languages.join(", ")} />
          <Row
            label="Авто-відповіді в інбоксі"
            value={settings ? (settings.auto_reply_enabled ? "увімкнено" : "вимкнено") : "…"}
          />
          <Row
            label="Режим підвищеної обережності"
            value={settings ? (settings.alert_mode ? "увімкнено" : "вимкнено") : "…"}
          />
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}
