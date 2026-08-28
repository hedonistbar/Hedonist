import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import type { BoardMember } from "../lib/database.types";

type BoardInvite = { id: string; email: string; created_at: string };

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
  const [invites, setInvites] = useState<BoardInvite[]>([]);
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
    if (isOwner) {
      const { data: invitesData } = await supabase
        .from("board_invites")
        .select("id, email, created_at")
        .eq("board_id", boardId)
        .order("created_at", { ascending: true });
      setInvites((invitesData as BoardInvite[] | null) ?? []);
    }
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
    const { data, error: invokeError } = await supabase.functions.invoke("invite-board-member", {
      body: { board_id: boardId, email },
    });
    setBusy(false);
    if (invokeError) {
      // supabase-js only exposes a parseable body on FunctionsHttpError,
      // whose context is a Response — a network-level failure
      // (FunctionsFetchError) carries a plain Error with no .json().
      const context = (invokeError as { context?: unknown }).context;
      const body = context instanceof Response ? await context.json().catch(() => null) : null;
      setError(body?.error ?? invokeError.message);
      return;
    }
    setSuccess(
      data?.status === "invited"
        ? `Приглашение отправлено на ${email} — доступ откроется автоматически после регистрации по ссылке в письме.`
        : `${email} добавлен(а) на доску.`,
    );
    setEmail("");
    load();
  }

  async function cancelInvite(inviteId: string) {
    await supabase.from("board_invites").delete().eq("id", inviteId);
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
            {invites.map((inv) => (
              <div className="team-row" key={inv.id}>
                <span>{inv.email}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="pill">приглашён(а)</span>
                  <button className="link-btn" style={{ padding: 0 }} onClick={() => cancelInvite(inv.id)}>
                    отменить
                  </button>
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
              Если у человека ещё нет аккаунта, мы отправим ему письмо со ссылкой для регистрации — доступ
              к доске откроется автоматически, как только он перейдёт по ней.
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
