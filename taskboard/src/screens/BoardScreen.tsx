import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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
import { backgroundCss } from "../lib/backgrounds";
import { initials } from "../lib/initials";
import { CardModal } from "../components/CardModal";
import { ShareModal } from "../components/ShareModal";
import { BackgroundModal } from "../components/BackgroundModal";
import type { Board, BoardMember, Card, ChecklistItem, List } from "../lib/database.types";

type Progress = { done: number; total: number };

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function CardFace({
  card,
  progress,
  attachCount,
  assignee,
  onOpen,
}: {
  card: Card;
  progress: Progress | undefined;
  attachCount: number;
  assignee: BoardMember | null;
  onOpen: () => void;
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
            <span className={`badge${urgency ? ` urgency-${urgency}` : ""}`}>🕐 {formatDueDate(card.due_date)}</span>
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
  const [newListTitle, setNewListTitle] = useState("");
  const [addingCardToList, setAddingCardToList] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"card" | "list" | null>(null);

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

  const bg = backgroundCss(boardBackground);

  return (
    <div className="board-screen" style={bg ? { background: bg } : undefined}>
      <div className="topbar">
        <button className="icon-btn" onClick={onBack}>
          ← Доски
        </button>
        <h1 style={{ fontSize: 18 }}>{boardName}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="icon-btn" onClick={() => setShowBackground(true)}>
            Фон
          </button>
          <button className="icon-btn" onClick={() => setShowShare(true)}>
            Поделиться
          </button>
        </div>
      </div>

      {error && <div className="error-text" style={{ margin: "8px 16px" }}>{error}</div>}

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
              <div className="card-face-top">
                <span className="card-face-title">{activeCard.title}</span>
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
          onClose={() => setShowBackground(false)}
          onChanged={load}
        />
      )}
    </div>
  );
}
