import { useMemo, useState } from "react";
import { swatchColor } from "../../lib/swatchColor";
import { TaskRow } from "../../components/TaskRow";
import type { Board, BoardMember, Card } from "../../lib/database.types";
import type { GoogleCalendarEvent } from "../../lib/googleCalendar";

type Progress = { done: number; total: number };

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarTab({
  cards,
  boardById,
  members,
  progressByCard,
  attachmentCounts,
  googleEvents,
  onOpenCard,
  onToggleDone,
}: {
  cards: Card[];
  boardById: Map<string, Board>;
  members: BoardMember[];
  progressByCard: Record<string, Progress>;
  attachmentCounts: Record<string, number>;
  googleEvents: GoogleCalendarEvent[];
  onOpenCard: (card: Card) => void;
  onToggleDone: (card: Card) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const days = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        return d;
      }),
    [today],
  );
  const [selected, setSelected] = useState(() => dateKey(today));

  const cardsByDay = useMemo(() => {
    const map: Record<string, Card[]> = {};
    for (const card of cards) {
      if (!card.due_date) continue;
      const key = dateKey(new Date(card.due_date));
      (map[key] ??= []).push(card);
    }
    return map;
  }, [cards]);

  function findAssignee(card: Card): BoardMember | null {
    if (!card.assigned_to) return null;
    return members.find((m) => m.board_id === card.board_id && m.user_id === card.assigned_to) ?? null;
  }

  const dayTasks = cardsByDay[selected] ?? [];

  const dayGoogleEvents = useMemo(
    () => googleEvents.filter((e) => dateKey(new Date(e.start)) === selected),
    [googleEvents, selected],
  );

  return (
    <div className="mobile-tab-content">
      <div className="mobile-tab-header">
        <h1 className="display-title" style={{ fontSize: 32 }}>
          Календарь
        </h1>
      </div>

      <div className="cal-day-strip">
        {days.map((d) => {
          const key = dateKey(d);
          const isToday = key === dateKey(today);
          const active = key === selected;
          return (
            <button
              key={key}
              type="button"
              className={`cal-day-chip${active ? " active" : ""}${!active && isToday ? " today" : ""}`}
              onClick={() => setSelected(key)}
            >
              <span className="cal-day-weekday">{d.toLocaleDateString("ru-RU", { weekday: "short" })}</span>
              <span className="cal-day-num">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="task-list-view" style={{ padding: 0 }}>
        {dayTasks.length === 0 ? (
          <p className="sub">На этот день задач нет.</p>
        ) : (
          dayTasks.map((card) => {
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
          })
        )}
      </div>

      {dayGoogleEvents.length > 0 && (
        <>
          <div className="section-label">Из Google Calendar</div>
          <div className="gcal-event-list">
            {dayGoogleEvents.map((e) => (
              <div key={e.id} className="gcal-event-row">
                <span className="gcal-event-time">
                  {e.allDay ? "весь день" : new Date(e.start).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="gcal-event-title">{e.title}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
