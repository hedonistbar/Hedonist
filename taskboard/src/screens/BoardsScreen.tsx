import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { enablePush, getPushStatus, isPushSupported, type PushStatus } from "../lib/push";
import { AISettingsModal } from "../components/AISettingsModal";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import type { Board } from "../lib/database.types";

export function BoardsScreen({ onOpenBoard }: { onOpenBoard: (board: Board) => void }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("unsubscribed");
  const [pushBusy, setPushBusy] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);

  useEffect(() => {
    if (isPushSupported()) getPushStatus().then(setPushStatus);
  }, []);

  async function handleEnablePush() {
    setPushBusy(true);
    setError(null);
    const result = await enablePush();
    setPushBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Не удалось включить уведомления.");
      return;
    }
    setPushStatus("subscribed");
  }

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("boards")
      .select("*")
      .order("updated_at", { ascending: false });
    if (loadError) setError(loadError.message);
    setBoards((data as Board[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createBoard(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    const { data, error: createError } = await supabase.rpc("create_board", { p_name: newName.trim() });
    setCreating(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    setNewName("");
    await load();
    if (data) onOpenBoard(data as Board);
  }

  return (
    <div className="boards-screen">
      <div className="topbar">
        <div className="brand">
          <Logo />
          <h1>Мои доски</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isPushSupported() && pushStatus !== "subscribed" && pushStatus !== "unsupported" && (
            <button className="icon-btn" onClick={handleEnablePush} disabled={pushBusy}>
              {pushBusy ? "…" : pushStatus === "denied" ? "Уведомления заблокированы" : "🔔 Включить уведомления"}
            </button>
          )}
          {pushStatus === "subscribed" && <span className="pill member">🔔 уведомления вкл.</span>}
          <ThemeToggle />
          <button className="icon-btn" onClick={() => setAiSettingsOpen(true)}>
            ✨ ИИ
          </button>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()}>
            Выйти
          </button>
        </div>
      </div>

      {aiSettingsOpen && <AISettingsModal onClose={() => setAiSettingsOpen(false)} />}

      <main className="content">
        <form className="new-board-form" onSubmit={createBoard}>
          <input
            placeholder="Название новой доски…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={creating || !newName.trim()}>
            {creating ? "Создаём…" : "+ Создать доску"}
          </button>
        </form>

        {error && <div className="error-text">{error}</div>}

        {loading ? (
          <p className="sub">Загрузка…</p>
        ) : boards.length === 0 ? (
          <p className="sub">Пока нет ни одной доски — создайте первую выше.</p>
        ) : (
          <div className="boards-grid">
            {boards.map((board) => (
              <button key={board.id} className="board-tile" onClick={() => onOpenBoard(board)}>
                <span className="board-tile-name">{board.name}</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
