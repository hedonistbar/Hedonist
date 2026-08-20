import { supabase } from "../lib/supabase";
import { BOARD_BACKGROUNDS } from "../lib/backgrounds";

export function BackgroundModal({
  boardId,
  current,
  onClose,
  onChanged,
}: {
  boardId: string;
  current: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  async function pick(id: string) {
    await supabase
      .from("boards")
      .update({ background: id === "default" ? null : id })
      .eq("id", boardId);
    onChanged();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Фон доски</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="bg-grid">
          {BOARD_BACKGROUNDS.map((bg) => (
            <button
              key={bg.id}
              className={`bg-swatch${(current ?? "default") === bg.id ? " active" : ""}`}
              style={bg.css ? { background: bg.css } : undefined}
              onClick={() => pick(bg.id)}
              title={bg.label}
            >
              {!bg.css && <span className="bg-swatch-none" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
