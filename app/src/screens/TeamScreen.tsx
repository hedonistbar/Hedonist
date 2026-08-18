import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import type { Restaurant, RestaurantUser } from "../lib/database.types";

export function TeamScreen({
  restaurant,
  membership,
}: {
  restaurant: Restaurant;
  membership: RestaurantUser;
}) {
  const [team, setTeam] = useState<RestaurantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadTeam() {
    setLoading(true);
    const { data } = await supabase
      .from("restaurant_users")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: true });
    setTeam(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  async function addAdmin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const { error: rpcError } = await supabase.rpc("add_admin_by_email", {
      p_restaurant_id: restaurant.id,
      p_email: email,
      p_display_name: name || null,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSuccess(`${email} додано як адміністратора.`);
    setEmail("");
    setName("");
    loadTeam();
  }

  return (
    <>
      <div className="card">
        <h2 style={{ fontSize: 16 }}>Команда</h2>
        <p className="sub">{restaurant.name}</p>
        {loading ? (
          <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Завантаження…</p>
        ) : (
          <div>
            {team.map((member) => (
              <div className="team-row" key={member.id}>
                <span>{member.display_name ?? "—"}</span>
                <span className={`pill ${member.role}`}>
                  {member.role === "owner" ? "власник" : "адміністратор"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {membership.role === "owner" && (
        <div className="card">
          <h2 style={{ fontSize: 16 }}>Додати адміністратора</h2>
          <p className="sub">Людина має вже мати акаунт у застосунку (хай спочатку зареєструється).</p>
          <form onSubmit={addAdmin}>
            <div className="field">
              <label htmlFor="admin-email">Email</label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-name">Ім'я (необов'язково)</label>
              <input id="admin-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {error && <div className="error-text" style={{ marginBottom: 14 }}>{error}</div>}
            {success && <div className="notice" style={{ marginBottom: 14 }}>{success}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Хвилинку…" : "Додати"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
