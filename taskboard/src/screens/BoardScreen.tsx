import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { dropIndexFromPointer, dropIndexFromPointerX } from "../lib/reorder";
import { CardModal } from "../components/CardModal";
import { ShareModal } from "../components/ShareModal";
import type { Board, BoardMember, Card, ChecklistItem, List } from "../lib/database.types";

type Progress = { done: number; total: number };

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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
  const [newListTitle, setNewListTitle] = useState("");
  const [addingCardToList, setAddingCardToList] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");

  const dragCard = useRef<{ id: string; fromListId: string } | null>(null);
  const dragList = useRef<string | null>(null);
  const listRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const listsRowRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const [listsRes, cardsRes, checklistRes, attachmentsRes, membersRes] = await Promise.all([
      supabase.from("lists").select("*").eq("board_id", board.id).order("position", { ascending: true }),
      supabase.from("cards").select("*").eq("board_id", board.id).order("position", { ascending: true }),
      supabase.from("checklist_items").select("*").eq("board_id", board.id),
      supabase.from("attachments").select("id, card_id").eq("board_id", board.id),
      supabase.from("board_members").select("*").eq("board_id", board.id),
    ]);
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

  async function persistCardDrop(targetListId: string, dropIndexRaw: number) {
    const drag = dragCard.current;
    dragCard.current = null;
    if (!drag) return;

    const draggedCard = cards.find((c) => c.id === drag.id);
    if (!draggedCard) return;

    const originalTargetList = cardsByList[targetListId] ?? [];
    // dropIndexRaw was computed against the DOM, which still includes the
    // dragged card at its original spot. If it's leaving from earlier in
    // this same list, everything after it shifts left by one once removed.
    let dropIndex = dropIndexRaw;
    if (drag.fromListId === targetListId) {
      const originalIndex = originalTargetList.findIndex((c) => c.id === drag.id);
      if (originalIndex !== -1 && originalIndex < dropIndex) dropIndex -= 1;
    }

    const targetCards = originalTargetList.filter((c) => c.id !== drag.id);
    targetCards.splice(dropIndex, 0, draggedCard);
    const orderedIds = targetCards.map((c) => c.id);

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
          .update(id === drag.id ? { list_id: targetListId, position: idx } : { position: idx })
          .eq("id", id),
      ),
    );
  }

  async function persistListDrop(dropIndexRaw: number) {
    const draggedId = dragList.current;
    dragList.current = null;
    if (!draggedId) return;

    // Same DOM-includes-the-dragged-element adjustment as persistCardDrop.
    const originalIndex = lists.findIndex((l) => l.id === draggedId);
    const dropIndex = originalIndex !== -1 && originalIndex < dropIndexRaw ? dropIndexRaw - 1 : dropIndexRaw;

    const remaining = lists.filter((l) => l.id !== draggedId);
    const dragged = lists.find((l) => l.id === draggedId)!;
    remaining.splice(dropIndex, 0, dragged);
    const orderedIds = remaining.map((l) => l.id);

    setLists((prev) =>
      prev.map((l) => {
        const idx = orderedIds.indexOf(l.id);
        return idx === -1 ? l : { ...l, position: idx };
      }),
    );

    await Promise.all(
      orderedIds.map((id, idx) => supabase.from("lists").update({ position: idx }).eq("id", id)),
    );
  }

  if (loading) return <div className="spinner-screen">Загрузка…</div>;

  return (
    <div className="board-screen">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack}>
          ← Доски
        </button>
        <h1 style={{ fontSize: 18 }}>{board.name}</h1>
        <button className="icon-btn" onClick={() => setShowShare(true)}>
          Поделиться
        </button>
      </div>

      {error && <div className="error-text" style={{ margin: "8px 16px" }}>{error}</div>}

      <div className="lists-row" ref={listsRowRef}>
        {lists.map((list) => (
          <div
            key={list.id}
            className="list-column"
            ref={(el) => {
              listRefs.current[list.id] = el;
            }}
            draggable
            onDragStart={(e) => {
              dragList.current = list.id;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragCard.current) {
                const idx = dropIndexFromPointer(listRefs.current[list.id]!, ".card-face", e.clientY);
                persistCardDrop(list.id, idx);
              } else if (dragList.current && listsRowRef.current) {
                const idx = dropIndexFromPointerX(listsRowRef.current, ".list-column", e.clientX);
                persistListDrop(idx);
              }
            }}
          >
            <div className="list-header">
              <span className="list-title">{list.title}</span>
              <button className="link-btn" style={{ padding: 0 }} onClick={() => deleteList(list)}>
                ✕
              </button>
            </div>

            <div className="list-cards">
              {(cardsByList[list.id] ?? []).map((card) => {
                const progress = progressByCard[card.id];
                const attachCount = attachmentCounts[card.id] ?? 0;
                const overdue = card.due_date && !card.is_done && new Date(card.due_date) < new Date();
                return (
                  <div
                    key={card.id}
                    className={`card-face${card.is_done ? " done" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      dragCard.current = { id: card.id, fromListId: list.id };
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => setSelectedCard(card)}
                  >
                    <span className="card-face-title">{card.title}</span>
                    {(card.due_date || progress || attachCount > 0) && (
                      <div className="card-face-meta">
                        {card.due_date && (
                          <span className={`badge${overdue ? " overdue" : ""}`}>
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
                );
              })}
            </div>

            {addingCardToList === list.id ? (
              <form className="inline-form" onSubmit={(e) => addCard(list.id, e)}>
                <input
                  autoFocus
                  placeholder="Название карточки…"
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setAddingCardToList(null);
                  }}
                />
                <button className="btn btn-primary" type="submit" disabled={!newCardTitle.trim()}>
                  Добавить
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setAddingCardToList(null);
                    setNewCardTitle("");
                  }}
                >
                  Отмена
                </button>
              </form>
            ) : (
              <button
                className="link-btn add-card-btn"
                onClick={() => {
                  setAddingCardToList(list.id);
                  setNewCardTitle("");
                }}
              >
                + Добавить карточку
              </button>
            )}
          </div>
        ))}

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

      {selectedCard && (
        <CardModal
          card={cards.find((c) => c.id === selectedCard.id) ?? selectedCard}
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
    </div>
  );
}
