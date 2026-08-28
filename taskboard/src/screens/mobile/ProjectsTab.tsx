import { useState } from "react";
import { swatchColor } from "../../lib/swatchColor";
import { backgroundCss } from "../../lib/backgrounds";
import type { Board } from "../../lib/database.types";

type Progress = { done: number; total: number };

export function ProjectsTab({
  boards,
  progressByBoard,
  isOwnerByBoard,
  onSelectProject,
  onShareBoard,
  onBackgroundBoard,
  onCreateBoard,
  onRenameBoard,
  onDeleteBoard,
}: {
  boards: Board[];
  progressByBoard: Record<string, Progress>;
  isOwnerByBoard: Record<string, boolean>;
  onSelectProject: (boardId: string) => void;
  onShareBoard: (board: Board) => void;
  onBackgroundBoard: (board: Board) => void;
  onCreateBoard: (name: string) => void;
  onRenameBoard: (boardId: string, name: string) => void;
  onDeleteBoard: (boardId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  return (
    <div className="mobile-tab-content">
      <div className="mobile-tab-header">
        <h1 className="display-title" style={{ fontSize: 32 }}>
          Доски
        </h1>
        <div className="display-subtitle">
          {boards.length === 0 ? "Пока пусто" : `${boards.length} ${boards.length === 1 ? "доска" : "досок"}`}
        </div>
      </div>

      <form
        className="new-board-form"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("name") as HTMLInputElement;
          if (!input.value.trim()) return;
          onCreateBoard(input.value.trim());
          input.value = "";
        }}
      >
        <input name="name" placeholder="Название новой доски…" />
        <button className="btn btn-primary" type="submit">
          + Создать
        </button>
      </form>

      {boards.length === 0 ? (
        <p className="sub">Пока нет ни одной доски — создайте первую выше.</p>
      ) : (
        <div className="boards-grid">
          {boards.map((board) => {
            const progress = progressByBoard[board.id];
            const color = swatchColor(board.id);
            const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
            const tileBg = board.background_image_path ? undefined : backgroundCss(board.background);
            return (
              <div
                key={board.id}
                className="board-tile"
                style={tileBg ? { cursor: "default", background: tileBg } : { cursor: "default" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="board-tile-swatch" style={{ background: color }} />
                  <span style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      className="link-btn"
                      style={{ padding: 2 }}
                      title="Фон доски"
                      onClick={() => onBackgroundBoard(board)}
                    >
                      🎨
                    </button>
                    <button
                      type="button"
                      className="link-btn"
                      style={{ padding: 2 }}
                      title="Поделиться"
                      onClick={() => onShareBoard(board)}
                    >
                      👥
                    </button>
                    {isOwnerByBoard[board.id] && (
                      <button
                        type="button"
                        className="link-btn"
                        style={{ padding: 2 }}
                        title="Переименовать"
                        onClick={() => {
                          setEditingId(board.id);
                          setEditValue(board.name);
                        }}
                      >
                        ✎
                      </button>
                    )}
                    {isOwnerByBoard[board.id] && (
                      <button
                        type="button"
                        className="link-btn"
                        style={{ padding: 2 }}
                        title="Удалить доску"
                        onClick={() => {
                          if (confirm(`Удалить доску «${board.name}» вместе со всем содержимым?`)) {
                            onDeleteBoard(board.id);
                          }
                        }}
                      >
                        🗑
                      </button>
                    )}
                  </span>
                </div>
                {editingId === board.id ? (
                  <input
                    className="board-tile-name"
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      if (editValue.trim() && editValue !== board.name) onRenameBoard(board.id, editValue.trim());
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="board-tile-name"
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      textAlign: "left",
                      cursor: "pointer",
                      color: "inherit",
                    }}
                    onClick={() => onSelectProject(board.id)}
                  >
                    {board.name}
                  </button>
                )}
                <span className="board-tile-progress-label">
                  {progress && progress.total > 0 ? `${progress.done} из ${progress.total} выполнено` : "Нет карточек"}
                </span>
                <span className="board-tile-track">
                  <span className="board-tile-track-fill" style={{ width: `${pct}%`, background: color }} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
