import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { enablePush, getPushStatus, isPushSupported, type PushStatus } from "../lib/push";
import { AISettingsModal } from "../components/AISettingsModal";
import { GoogleCalendarSettingsModal } from "../components/GoogleCalendarSettingsModal";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { swatchColor } from "../lib/swatchColor";
import type { Board } from "../lib/database.types";

type Progress = { done: number; total: number };

export function BoardsScreen({ onOpenBoard }: { onOpenBoard: (board: Board) => void }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [progressByBoard, setProgressByBoard] = useState<Record<string, Progress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("unsubscribed");
  const [pushBusy, setPushBusy] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [googleSettingsOpen, setGoogleSettingsOpen] = useState(false);

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
    const [boardsRes, cardsRes] = await Promise.all([
      supabase.from("boards").select("*").order("updated_at", { ascending: false }),
      supabase.from("cards").select("board_id, is_done"),
    ]);
    if (boardsRes.error) setError(boardsRes.error.message);
    setBoards((boardsRes.data as Board[] | null) ?? []);
    const progress: Record<string, Progress> = {};
    for (const row of (cardsRes.data as { board_id: string; is_done: boolean }[] | null) ?? []) {
      const p = (progress[row.board_id] ??= { done: 0, total: 0 });
      p.total += 1;
      if (row.is_done) p.done += 1;
    }
    setProgressByBoard(progress);
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
          <button className="icon-btn" onClick={() => setGoogleSettingsOpen(true)}>
            📅 Google Calendar
          </button>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()}>
            Выйти
          </button>
        </div>
      </div>

      {aiSettingsOpen && <AISettingsModal onClose={() => setAiSettingsOpen(false)} />}
      {googleSettingsOpen && <GoogleCalendarSettingsModal onClose={() => setGoogleSettingsOpen(false)} />}

      <main className="content">
        <div style={{ marginBottom: 22 }}>
          <h1 className="display-title" style={{ fontSize: 34 }}>
            Мои доски
          </h1>
          <div className="display-subtitle">
            {boards.length === 0 ? "Пока пусто" : `${boards.length} ${boards.length === 1 ? "доска" : "досок"}`}
          </div>
        </div>

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
            {boards.map((board) => {
              const progress = progressByBoard[board.id];
              const color = swatchColor(board.id);
              const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
              return (
                <button key={board.id} className="board-tile" onClick={() => onOpenBoard(board)}>
                  <span className="board-tile-swatch" style={{ background: color }} />
                  <span className="board-tile-name">{board.name}</span>
                  <span className="board-tile-progress-label">
                    {progress && progress.total > 0
                      ? `${progress.done} из ${progress.total} выполнено`
                      : "Нет карточек"}
                  </span>
                  <span className="board-tile-track">
                    <span className="board-tile-track-fill" style={{ width: `${pct}%`, background: color }} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
