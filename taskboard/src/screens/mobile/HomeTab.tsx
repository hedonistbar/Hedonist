import { useMemo, useState } from "react";
import { dueBucket } from "../../lib/dueBucket";
import { swatchColor } from "../../lib/swatchColor";
import { TaskRow } from "../../components/TaskRow";
import type { Board, BoardMember, Card } from "../../lib/database.types";

type Progress = { done: number; total: number };

export function HomeTab({
  cards,
  boardById,
  members,
  progressByCard,
  attachmentCounts,
  projectFilter,
  onClearFilter,
  onOpenCard,
  onToggleDone,
}: {
  cards: Card[];
  boardById: Map<string, Board>;
  members: BoardMember[];
  progressByCard: Record<string, Progress>;
  attachmentCounts: Record<string, number>;
  projectFilter: string | null;
  onClearFilter: () => void;
  onOpenCard: (card: Card) => void;
  onToggleDone: (card: Card) => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const filterBoard = projectFilter ? boardById.get(projectFilter) : null;

  const visibleCards = useMemo(
    () => (projectFilter ? cards.filter((c) => c.board_id === projectFilter) : cards),
    [cards, projectFilter],
  );

  const sections = useMemo(() => {
    const active = visibleCards.filter((c) => !c.is_done);
    const overdue = active.filter((c) => dueBucket(c) === "overdue");
    const today = active.filter((c) => dueBucket(c) === "today");
    const upcoming = active
      .filter((c) => dueBucket(c) === "upcoming")
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    const someday = active.filter((c) => dueBucket(c) === "someday");
    const completed = visibleCards.filter((c) => c.is_done);
    return { overdue, today, upcoming, someday, completed };
  }, [visibleCards]);

  function findAssignee(card: Card): BoardMember | null {
    if (!card.assigned_to) return null;
    return members.find((m) => m.board_id === card.board_id && m.user_id === card.assigned_to) ?? null;
  }

  function row(card: Card) {
    const board = boardById.get(card.board_id);
    return (
      <TaskRow
        key={card.id}
        card={card}
        tagColor={board ? swatchColor(board.id) : undefined}
        tagLabel={board?.name}
        progress={progressByCard[card.id]}
        attachCount={attachmentCounts[card.id] ?? 0}
        assignee={findAssignee(card)}
        onOpen={() => onOpenCard(card)}
        onToggleDone={() => onToggleDone(card)}
      />
    );
  }

  const empty =
    sections.overdue.length === 0 &&
    sections.today.length === 0 &&
    sections.upcoming.length === 0 &&
    sections.someday.length === 0 &&
    sections.completed.length === 0;

  return (
    <div className="mobile-tab-content">
      <div className="mobile-tab-header">
        <h1 className="display-title" style={{ fontSize: 32 }}>
          Главная
        </h1>
        <div className="display-subtitle">
          {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      {filterBoard && (
        <button className="filter-pill" onClick={onClearFilter}>
          Доска: {filterBoard.name} <span>✕</span>
        </button>
      )}

      <div className="task-list-view" style={{ padding: 0 }}>
        {empty ? (
          <p className="sub">Нет задач — загляните в «Доски», чтобы создать первую.</p>
        ) : (
          <>
            {sections.overdue.length > 0 && (
              <>
                <div className="task-section-label danger">Просрочено · {sections.overdue.length}</div>
                {sections.overdue.map(row)}
              </>
            )}
            {sections.today.length > 0 && (
              <>
                <div className="task-section-label">Сегодня · {sections.today.length}</div>
                {sections.today.map(row)}
              </>
            )}
            {sections.upcoming.length > 0 && (
              <>
                <div className="task-section-label">Предстоящие · {sections.upcoming.length}</div>
                {sections.upcoming.map(row)}
              </>
            )}
            {sections.someday.length > 0 && (
              <>
                <div className="task-section-label">Когда-нибудь · {sections.someday.length}</div>
                {sections.someday.map(row)}
              </>
            )}
            {sections.completed.length > 0 && (
              <>
                <div className="task-completed-toggle" onClick={() => setShowCompleted((v) => !v)}>
                  <span>Выполнено · {sections.completed.length}</span>
                  <span className={`task-completed-chevron${showCompleted ? " open" : ""}`}>⌄</span>
                </div>
                {showCompleted && sections.completed.map(row)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
