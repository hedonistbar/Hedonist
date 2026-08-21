import { dueUrgency } from "../lib/dueUrgency";
import { formatDueDate } from "../lib/dueBucket";
import { initials } from "../lib/initials";
import type { BoardMember, Card } from "../lib/database.types";

type Progress = { done: number; total: number };

/** Shares CSS classes with the kanban board's card face, but as a plain
 * row (no dnd-kit sortable wiring — nothing to reorder in a flat list).
 * tagColor/tagLabel show whatever grouping context the flat view lost —
 * a board's list on a single-board screen, or the board itself when
 * flattened across boards on the Home tab. */
export function TaskRow({
  card,
  tagColor,
  tagLabel,
  progress,
  attachCount,
  assignee,
  onOpen,
  onToggleDone,
}: {
  card: Card;
  tagColor?: string;
  tagLabel?: string;
  progress: Progress | undefined;
  attachCount: number;
  assignee: BoardMember | null;
  onOpen: () => void;
  onToggleDone: () => void;
}) {
  const urgency = dueUrgency(card.due_date, card.is_done);

  return (
    <div className={`card-face${card.is_done ? " done" : ""}`} onClick={onOpen}>
      <button
        type="button"
        className={`card-checkbox${card.is_done ? " checked" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone();
        }}
        aria-label={card.is_done ? "Отметить как невыполненную" : "Отметить как выполненную"}
      >
        {card.is_done && (
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path
              d="M1 5l3.2 3.2L11 1"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <div className="card-face-body">
        <div className="card-face-top">
          <span className="card-face-title">{card.title}</span>
          {assignee && (
            <span className="avatar" title={assignee.display_name ?? undefined}>
              {initials(assignee.display_name)}
            </span>
          )}
        </div>
        {tagLabel && (
          <span className="task-row-list-tag">
            {tagColor && <span className="task-row-list-dot" style={{ background: tagColor }} />}
            {tagLabel}
          </span>
        )}
        {(card.due_date || progress || attachCount > 0) && (
          <div className="card-face-meta">
            {card.due_date && (
              <span className={`badge${urgency ? ` urgency-${urgency}` : ""}`}>
                🕐 {formatDueDate(card.due_date)}
              </span>
            )}
            {progress && (
              <span className="badge">
                ☑ {progress.done}/{progress.total}
              </span>
            )}
            {attachCount > 0 && <span className="badge">📎 {attachCount}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
