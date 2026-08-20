import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import type { BoardMember } from "../lib/database.types";

export function ShareModal({
  boardId,
  currentUserId,
  isOwner,
  onClose,
}: {
  boardId: string;
  currentUserId: string;
  isOwner: boolean;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("board_members")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: true });
    setMembers((data as BoardMember[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const { error: rpcError } = await supabase.rpc("share_board_by_email", {
      p_board_id: boardId,
      p_email: email,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSuccess(`${email} добавлен(а) на доску.`);
    setEmail("");
    load();
  }

  async function removeMember(memberId: string) {
    await supabase.from("board_members").delete().eq("id", memberId);
    load();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Доступ к доске</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <p className="sub">Загрузка…</p>
        ) : (
          <div>
            {members.map((m) => (
              <div className="team-row" key={m.id}>
                <span>{m.display_name ?? m.user_id}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`pill ${m.role}`}>{m.role === "owner" ? "владелец" : "участник"}</span>
                  {isOwner && m.role !== "owner" && (
                    <button className="link-btn" style={{ padding: 0 }} onClick={() => removeMember(m.id)}>
                      убрать
                    </button>
                  )}
                  {!isOwner && m.user_id === currentUserId && (
                    <button className="link-btn" style={{ padding: 0 }} onClick={() => removeMember(m.id)}>
                      покинуть
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {isOwner && (
          <form onSubmit={invite} style={{ marginTop: 18 }}>
            <div className="field">
              <label htmlFor="share-email">Поделиться по email</label>
              <input
                id="share-email"
                type="email"
                required
                placeholder="email супруга/супруги…"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <p className="sub" style={{ marginBottom: 12 }}>
              Человек должен сначала зарегистрироваться в Ivchenko Hub с этим email.
            </p>
            {error && (
              <div className="error-text" style={{ marginBottom: 12 }}>
                {error}
              </div>
            )}
            {success && (
              <div className="notice" style={{ marginBottom: 12 }}>
                {success}
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Добавляем…" : "Добавить"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
