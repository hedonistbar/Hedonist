import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../lib/supabase";
import { dueUrgency } from "../lib/dueUrgency";
import { backgroundCss, getBoardBackgroundImageUrl } from "../lib/backgrounds";
import { initials } from "../lib/initials";
import { useIsMobile } from "../lib/useIsMobile";
import { CardModal } from "../components/CardModal";
import { ShareModal } from "../components/ShareModal";
import { BackgroundModal } from "../components/BackgroundModal";
import { ThemeToggle } from "../components/ThemeToggle";
import type { Board, BoardMember, Card, ChecklistItem, List } from "../lib/database.types";

type Progress = { done: number; total: number };
type ViewMode = "board" | "list";
type DueBucket = "overdue" | "today" | "upcoming" | "someday";

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Groups an active (not done) card the way the reference Home screen
 * does: by calendar day relative to today, not just dueUrgency's
 * overdue/today/soon flag (which only flags the next couple of days). */
function dueBucket(card: Card): DueBucket {
  if (!card.due_date) return "someday";
  const due = new Date(card.due_date);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  if (startOfDueDay < startOfToday) return "overdue";
  if (startOfDueDay.getTime() === startOfToday.getTime()) return "today";
  return "upcoming";
}

function CardFace({
  card,
  progress,
  attachCount,
  assignee,
  onOpen,
  onToggleDone,
}: {
  card: Card;
  progress: Progress | undefined;
  attachCount: number;
  assignee: BoardMember | null;
  onOpen: () => void;
  onToggleDone: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", listId: card.list_id },
  });
  const urgency = dueUrgency(card.due_date, card.is_done);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`card-face${card.is_done ? " done" : ""}`}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
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

/** Same visual language as CardFace (shares its CSS classes), but for the
 * flat "Список" view: no dnd-kit sortable wiring (nothing to reorder
 * there), and shows the card's list as a small tag since flattening the
 * board loses that grouping. */
function TaskRow({
  card,
  listTitle,
  progress,
  attachCount,
  assignee,
  onOpen,
  onToggleDone,
}: {
  card: Card;
  listTitle: string;
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
        {listTitle && <span className="task-row-list-tag">{listTitle}</span>}
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

function ListColumn({
  list,
  cardIds,
  children,
  onDelete,
  addingCard,
  onStartAddCard,
  onCancelAddCard,
  newCardTitle,
  onNewCardTitleChange,
  onSubmitCard,
}: {
  list: List;
  cardIds: string[];
  children: React.ReactNode;
  onDelete: () => void;
  addingCard: boolean;
  onStartAddCard: () => void;
  onCancelAddCard: () => void;
  newCardTitle: string;
  onNewCardTitleChange: (v: string) => void;
  onSubmitCard: (e: FormEvent) => void;
}) {
  const sortable = useSortable({ id: list.id, data: { type: "list" } });
  const droppable = useDroppable({ id: `cards-${list.id}`, data: { type: "list-container", listId: list.id } });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.5 : 1,
  };

  return (
    <div ref={sortable.setNodeRef} style={style} className="list-column">
      <div className="list-header" {...sortable.attributes} {...sortable.listeners}>
        <span className="list-title">{list.title}</span>
        <button
          className="link-btn"
          style={{ padding: 0 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
        >
          ✕
        </button>
      </div>

      <div className="list-cards" ref={droppable.setNodeRef}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </div>

      {addingCard ? (
        <form className="inline-form" onSubmit={onSubmitCard}>
          <input
            autoFocus
            placeholder="Название карточки…"
            value={newCardTitle}
            onChange={(e) => onNewCardTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancelAddCard();
            }}
          />
          <button className="btn btn-primary" type="submit" disabled={!newCardTitle.trim()}>
            Добавить
          </button>
          <button type="button" className="link-btn" onClick={onCancelAddCard}>
            Отмена
          </button>
        </form>
      ) : (
        <button className="link-btn add-card-btn" onClick={onStartAddCard}>
          + Добавить карточку
        </button>
      )}
    </div>
  );
}

export function BoardScreen({
  board,
  userId,
  onBack,
}: {
  board: Board;
  userId: string;
  onBack: () => void;
}) {
  const [lists, setLists] = useState<List[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showBackground, setShowBackground] = useState(false);
  const [boardName, setBoardName] = useState(board.name);
  const [boardBackground, setBoardBackground] = useState(board.background);
  const [boardBackgroundImagePath, setBoardBackgroundImagePath] = useState(board.background_image_path);
  const [boardBackgroundImageUrl, setBoardBackgroundImageUrl] = useState<string | null>(null);
  const [newListTitle, setNewListTitle] = useState("");
  const [addingCardToList, setAddingCardToList] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"card" | "list" | null>(null);
  const [showCompletedList, setShowCompletedList] = useState(false);
  // Touch devices get the flat, tap-friendly "Список" view — dragging cards
  // between columns is fiddly on a phone. Desktop keeps the kanban board
  // with drag & drop, where there's room for columns and a mouse to drag
  // with. Not a manual toggle: it follows the viewport.
  const isMobile = useIsMobile();
  const viewMode: ViewMode = isMobile ? "list" : "board";

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const load = useCallback(async () => {
    const [boardRes, listsRes, cardsRes, checklistRes, attachmentsRes, membersRes] = await Promise.all([
      supabase.from("boards").select("*").eq("id", board.id).maybeSingle(),
      supabase.from("lists").select("*").eq("board_id", board.id).order("position", { ascending: true }),
      supabase.from("cards").select("*").eq("board_id", board.id).order("position", { ascending: true }),
      supabase.from("checklist_items").select("*").eq("board_id", board.id),
      supabase.from("attachments").select("id, card_id").eq("board_id", board.id),
      supabase.from("board_members").select("*").eq("board_id", board.id),
    ]);
    if (boardRes.data) {
      setBoardName((boardRes.data as Board).name);
      setBoardBackground((boardRes.data as Board).background);
      setBoardBackgroundImagePath((boardRes.data as Board).background_image_path);
    }
    if (listsRes.error) setError(listsRes.error.message);
    setLists((listsRes.data as List[] | null) ?? []);
    setCards((cardsRes.data as Card[] | null) ?? []);
    setChecklistItems((checklistRes.data as ChecklistItem[] | null) ?? []);
    const counts: Record<string, number> = {};
    for (const row of (attachmentsRes.data as { card_id: string }[] | null) ?? []) {
      counts[row.card_id] = (counts[row.card_id] ?? 0) + 1;
    }
    setAttachmentCounts(counts);
    setMembers((membersRes.data as BoardMember[] | null) ?? []);
    setLoading(false);
  }, [board.id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`board-${board.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "boards", filter: `id=eq.${board.id}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lists", filter: `board_id=eq.${board.id}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cards", filter: `board_id=eq.${board.id}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_items", filter: `board_id=eq.${board.id}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attachments", filter: `board_id=eq.${board.id}` },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_members", filter: `board_id=eq.${board.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [board.id, load]);

  useEffect(() => {
    if (!boardBackgroundImagePath) {
      setBoardBackgroundImageUrl(null);
      return;
    }
    getBoardBackgroundImageUrl(boardBackgroundImagePath).then(setBoardBackgroundImageUrl);
  }, [boardBackgroundImagePath]);

  const myMembership = members.find((m) => m.user_id === userId) ?? null;
  const isOwner = myMembership?.role === "owner";

  const cardsByList = useMemo(() => {
    const map: Record<string, Card[]> = {};
    for (const list of lists) map[list.id] = [];
    for (const card of cards) (map[card.list_id] ??= []).push(card);
    for (const key of Object.keys(map)) map[key].sort((a, b) => a.position - b.position);
    return map;
  }, [lists, cards]);

  const progressByCard = useMemo(() => {
    const map: Record<string, Progress> = {};
    for (const item of checklistItems) {
      const p = (map[item.card_id] ??= { done: 0, total: 0 });
      p.total += 1;
      if (item.is_done) p.done += 1;
    }
    return map;
  }, [checklistItems]);

  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  const sections = useMemo(() => {
    const active = cards.filter((c) => !c.is_done);
    const overdue = active.filter((c) => dueBucket(c) === "overdue");
    const today = active.filter((c) => dueBucket(c) === "today");
    const upcoming = active
      .filter((c) => dueBucket(c) === "upcoming")
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    const someday = active.filter((c) => dueBucket(c) === "someday");
    const completed = cards.filter((c) => c.is_done);
    return { overdue, today, upcoming, someday, completed };
  }, [cards]);

  const memberById = new Map(members.map((m) => [m.user_id, m]));
  const activeCard = activeType === "card" ? cards.find((c) => c.id === activeId) : null;
  const activeList = activeType === "list" ? lists.find((l) => l.id === activeId) : null;

  async function addList(e: FormEvent) {
    e.preventDefault();
    const title = newListTitle.trim();
    if (!title) return;
    const position = lists.length ? Math.max(...lists.map((l) => l.position)) + 1 : 0;
    setNewListTitle("");
    const { error: insertError } = await supabase.from("lists").insert({ board_id: board.id, title, position });
    if (insertError) setError(insertError.message);
    load();
  }

  async function deleteList(list: List) {
    if (!confirm(`Удалить список «${list.title}» вместе со всеми карточками?`)) return;
    await supabase.from("lists").delete().eq("id", list.id);
    load();
  }

  async function addCard(listId: string, e: FormEvent) {
    e.preventDefault();
    const title = newCardTitle.trim();
    if (!title) return;
    const listCards = cardsByList[listId] ?? [];
    const position = listCards.length ? Math.max(...listCards.map((c) => c.position)) + 1 : 0;
    setNewCardTitle("");
    const { error: insertError } = await supabase
      .from("cards")
      .insert({ board_id: board.id, list_id: listId, title, position });
    if (insertError) setError(insertError.message);
    load();
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    setActiveType((event.active.data.current?.type as "card" | "list") ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.data.current?.type !== "card") return;

    const activeCardId = active.id as string;
    const activeCard = cards.find((c) => c.id === activeCardId);
    if (!activeCard) return;

    let overListId: string | undefined;
    const overData = over.data.current;
    if (overData?.type === "card") {
      overListId = cards.find((c) => c.id === over.id)?.list_id;
    } else if (overData?.type === "list-container") {
      overListId = overData.listId as string;
    } else if (overData?.type === "list") {
      // Dropped on a list's own header/reorder zone rather than its cards
      // area or a card within it — still counts as "into this list".
      overListId = over.id as string;
    }
    if (!overListId || overListId === activeCard.list_id) return;

    setCards((prev) => prev.map((c) => (c.id === activeCardId ? { ...c, list_id: overListId! } : c)));
  }

  async function toggleCardDone(card: Card) {
    const next = !card.is_done;
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, is_done: next } : c)));
    await supabase.from("cards").update({ is_done: next }).eq("id", card.id);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);
    if (!over) return;

    if (active.data.current?.type === "list") {
      if (active.id === over.id) return;
      const oldIndex = lists.findIndex((l) => l.id === active.id);
      const newIndex = lists.findIndex((l) => l.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(lists, oldIndex, newIndex);
      setLists(reordered);
      await Promise.all(
        reordered.map((l, idx) => supabase.from("lists").update({ position: idx }).eq("id", l.id)),
      );
      return;
    }

    const activeCardId = active.id as string;
    const activeCard = cards.find((c) => c.id === activeCardId);
    if (!activeCard) return;
    const targetListId = activeCard.list_id;

    let overCardId: string | null = null;
    const overData = over.data.current;
    if (overData?.type === "card" && over.id !== activeCardId) {
      overCardId = over.id as string;
    }

    const listCardIds = (cardsByList[targetListId] ?? []).map((c) => c.id);
    let orderedIds = listCardIds.includes(activeCardId) ? listCardIds : [...listCardIds, activeCardId];
    if (overCardId) {
      const oldIdx = orderedIds.indexOf(activeCardId);
      const newIdx = orderedIds.indexOf(overCardId);
      if (oldIdx !== -1 && newIdx !== -1) orderedIds = arrayMove(orderedIds, oldIdx, newIdx);
    }

    setCards((prev) =>
      prev.map((c) => {
        const idx = orderedIds.indexOf(c.id);
        if (idx === -1) return c;
        return { ...c, list_id: targetListId, position: idx };
      }),
    );

    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase
          .from("cards")
          .update(id === activeCardId ? { list_id: targetListId, position: idx } : { position: idx })
          .eq("id", id),
      ),
    );
  }

  if (loading) return <div className="spinner-screen">Загрузка…</div>;

  const bgStyle: CSSProperties | undefined = boardBackgroundImageUrl
    ? { backgroundImage: `url(${boardBackgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : backgroundCss(boardBackground)
      ? { background: backgroundCss(boardBackground)! }
      : undefined;

  return (
    <div className="board-screen" style={bgStyle}>
      <div className="topbar">
        <button className="icon-btn" onClick={onBack}>
          ← Доски
        </button>
        <h1 className="display-title" style={{ fontSize: 22 }}>
          {boardName}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <ThemeToggle />
          <button className="icon-btn" onClick={() => setShowBackground(true)}>
            Фон
          </button>
          <button className="icon-btn" onClick={() => setShowShare(true)}>
            Поделиться
          </button>
        </div>
      </div>

      {error && <div className="error-text" style={{ margin: "8px 16px" }}>{error}</div>}

      {viewMode === "list" ? (
        <div className="task-list-view">
          {sections.overdue.length === 0 &&
          sections.today.length === 0 &&
          sections.upcoming.length === 0 &&
          sections.someday.length === 0 &&
          sections.completed.length === 0 ? (
            <p className="sub">На этой доске пока нет карточек.</p>
          ) : (
            <>
              {sections.overdue.length > 0 && (
                <>
                  <div className="task-section-label danger">Просрочено · {sections.overdue.length}</div>
                  {sections.overdue.map((card) => (
                    <TaskRow
                      key={card.id}
                      card={card}
                      listTitle={listById.get(card.list_id)?.title ?? ""}
                      progress={progressByCard[card.id]}
                      attachCount={attachmentCounts[card.id] ?? 0}
                      assignee={card.assigned_to ? (memberById.get(card.assigned_to) ?? null) : null}
                      onOpen={() => setSelectedCard(card)}
                      onToggleDone={() => toggleCardDone(card)}
                    />
                  ))}
                </>
              )}
              {sections.today.length > 0 && (
                <>
                  <div className="task-section-label">Сегодня · {sections.today.length}</div>
                  {sections.today.map((card) => (
                    <TaskRow
                      key={card.id}
                      card={card}
                      listTitle={listById.get(card.list_id)?.title ?? ""}
                      progress={progressByCard[card.id]}
                      attachCount={attachmentCounts[card.id] ?? 0}
                      assignee={card.assigned_to ? (memberById.get(card.assigned_to) ?? null) : null}
                      onOpen={() => setSelectedCard(card)}
                      onToggleDone={() => toggleCardDone(card)}
                    />
                  ))}
                </>
              )}
              {sections.upcoming.length > 0 && (
                <>
                  <div className="task-section-label">Предстоящие · {sections.upcoming.length}</div>
                  {sections.upcoming.map((card) => (
                    <TaskRow
                      key={card.id}
                      card={card}
                      listTitle={listById.get(card.list_id)?.title ?? ""}
                      progress={progressByCard[card.id]}
                      attachCount={attachmentCounts[card.id] ?? 0}
                      assignee={card.assigned_to ? (memberById.get(card.assigned_to) ?? null) : null}
                      onOpen={() => setSelectedCard(card)}
                      onToggleDone={() => toggleCardDone(card)}
                    />
                  ))}
                </>
              )}
              {sections.someday.length > 0 && (
                <>
                  <div className="task-section-label">Когда-нибудь · {sections.someday.length}</div>
                  {sections.someday.map((card) => (
                    <TaskRow
                      key={card.id}
                      card={card}
                      listTitle={listById.get(card.list_id)?.title ?? ""}
                      progress={progressByCard[card.id]}
                      attachCount={attachmentCounts[card.id] ?? 0}
                      assignee={card.assigned_to ? (memberById.get(card.assigned_to) ?? null) : null}
                      onOpen={() => setSelectedCard(card)}
                      onToggleDone={() => toggleCardDone(card)}
                    />
                  ))}
                </>
              )}
              {sections.completed.length > 0 && (
                <>
                  <div
                    className="task-completed-toggle"
                    onClick={() => setShowCompletedList((v) => !v)}
                  >
                    <span>Выполнено · {sections.completed.length}</span>
                    <span className={`task-completed-chevron${showCompletedList ? " open" : ""}`}>⌄</span>
                  </div>
                  {showCompletedList &&
                    sections.completed.map((card) => (
                      <TaskRow
                        key={card.id}
                        card={card}
                        listTitle={listById.get(card.list_id)?.title ?? ""}
                        progress={progressByCard[card.id]}
                        attachCount={attachmentCounts[card.id] ?? 0}
                        assignee={card.assigned_to ? (memberById.get(card.assigned_to) ?? null) : null}
                        onOpen={() => setSelectedCard(card)}
                        onToggleDone={() => toggleCardDone(card)}
                      />
                    ))}
                </>
              )}
            </>
          )}
        </div>
      ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="lists-row">
          <SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
            {lists.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                cardIds={(cardsByList[list.id] ?? []).map((c) => c.id)}
                onDelete={() => deleteList(list)}
                addingCard={addingCardToList === list.id}
                onStartAddCard={() => {
                  setAddingCardToList(list.id);
                  setNewCardTitle("");
                }}
                onCancelAddCard={() => {
                  setAddingCardToList(null);
                  setNewCardTitle("");
                }}
                newCardTitle={newCardTitle}
                onNewCardTitleChange={setNewCardTitle}
                onSubmitCard={(e) => addCard(list.id, e)}
              >
                {(cardsByList[list.id] ?? []).map((card) => (
                  <CardFace
                    key={card.id}
                    card={card}
                    progress={progressByCard[card.id]}
                    attachCount={attachmentCounts[card.id] ?? 0}
                    assignee={card.assigned_to ? (memberById.get(card.assigned_to) ?? null) : null}
                    onOpen={() => setSelectedCard(card)}
                    onToggleDone={() => toggleCardDone(card)}
                  />
                ))}
              </ListColumn>
            ))}
          </SortableContext>

          <form className="new-list-form" onSubmit={addList}>
            <input
              placeholder="+ Добавить список…"
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
            />
            {newListTitle.trim() && (
              <button className="btn btn-primary" type="submit">
                Добавить
              </button>
            )}
          </form>
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="card-face drag-overlay">
              <div className={`card-checkbox${activeCard.is_done ? " checked" : ""}`} />
              <div className="card-face-body">
                <div className="card-face-top">
                  <span className="card-face-title">{activeCard.title}</span>
                </div>
              </div>
            </div>
          ) : activeList ? (
            <div className="list-column drag-overlay">
              <div className="list-header">
                <span className="list-title">{activeList.title}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {selectedCard && (
        <CardModal
          card={cards.find((c) => c.id === selectedCard.id) ?? selectedCard}
          members={members}
          onClose={() => setSelectedCard(null)}
          onChanged={load}
          onDeleted={() => {
            setSelectedCard(null);
            load();
          }}
        />
      )}

      {showShare && myMembership && (
        <ShareModal
          boardId={board.id}
          currentUserId={userId}
          isOwner={isOwner}
          onClose={() => setShowShare(false)}
        />
      )}

      {showBackground && (
        <BackgroundModal
          boardId={board.id}
          current={boardBackground}
          currentImagePath={boardBackgroundImagePath}
          onClose={() => setShowBackground(false)}
          onChanged={load}
        />
      )}
    </div>
  );
}
