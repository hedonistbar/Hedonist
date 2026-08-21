import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { disablePush, enablePush, getPushStatus, isPushSupported, type PushStatus } from "../lib/push";
import { BottomTabBar, type MobileTab } from "../components/BottomTabBar";
import { CardModal } from "../components/CardModal";
import { ShareModal } from "../components/ShareModal";
import { BackgroundModal } from "../components/BackgroundModal";
import { AISettingsModal } from "../components/AISettingsModal";
import { Logo } from "../components/Logo";
import { HomeTab } from "./mobile/HomeTab";
import { ProjectsTab } from "./mobile/ProjectsTab";
import { CalendarTab } from "./mobile/CalendarTab";
import { ProfileTab } from "./mobile/ProfileTab";
import type { Board, BoardMember, Card, ChecklistItem, List } from "../lib/database.types";

type Progress = { done: number; total: number };

/** A lightweight "New Task" sheet — the reference's Task Composer picks
 * Project via chips, but our cards also need a List within that board's
 * own structure, so this adds one more field. Boards created from
 * onCreateBoard always get a default list, so every board here has at
 * least one option. */
function NewCardModal({
  boards,
  lists,
  defaultBoardId,
  onClose,
  onCreated,
}: {
  boards: Board[];
  lists: List[];
  defaultBoardId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const boardsWithLists = useMemo(
    () => boards.filter((b) => lists.some((l) => l.board_id === b.id)),
    [boards, lists],
  );
  const [boardId, setBoardId] = useState(
    defaultBoardId && boardsWithLists.some((b) => b.id === defaultBoardId)
      ? defaultBoardId
      : (boardsWithLists[0]?.id ?? ""),
  );
  const listsForBoard = useMemo(() => lists.filter((l) => l.board_id === boardId), [lists, boardId]);
  const [listId, setListId] = useState(listsForBoard[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [dueChoice, setDueChoice] = useState<"today" | "tomorrow" | "nextWeek" | "none">("none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setListId(lists.find((l) => l.board_id === boardId)?.id ?? "");
  }, [boardId, lists]);

  function dueDateFor(choice: typeof dueChoice): string | null {
    if (choice === "none") return null;
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    if (choice === "tomorrow") d.setDate(d.getDate() + 1);
    if (choice === "nextWeek") d.setDate(d.getDate() + 7);
    return d.toISOString();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !listId) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("cards").insert({
      board_id: boardId,
      list_id: listId,
      title: title.trim(),
      due_date: dueDateFor(dueChoice),
      position: 0,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onCreated();
    onClose();
  }

  if (boardsWithLists.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Новая задача</h2>
            <button className="icon-btn" onClick={onClose}>
              ✕
            </button>
          </div>
          <p className="sub">
            Сначала создайте доску и хотя бы один список (на компьютере, в виде доски) — тогда здесь появится
            выбор.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-modal-header">
          <span className="section-label" style={{ margin: 0 }}>
            Новая задача
          </span>
          <button className="text-link-muted" onClick={onClose}>
            Отмена
          </button>
        </div>
        {error && <div className="error-text">{error}</div>}
        <form onSubmit={submit}>
          <input
            className="card-title-input"
            placeholder="Название задачи"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="section-label">Доска</div>
          <div className="picker-row">
            {boardsWithLists.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`picker-chip${boardId === b.id ? " active" : ""}`}
                onClick={() => setBoardId(b.id)}
              >
                {b.name}
              </button>
            ))}
          </div>

          <div className="section-label">Список</div>
          <div className="picker-row">
            {listsForBoard.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`picker-chip${listId === l.id ? " active" : ""}`}
                onClick={() => setListId(l.id)}
              >
                {l.title}
              </button>
            ))}
          </div>

          <div className="section-label">Срок</div>
          <div className="picker-row">
            {(
              [
                ["today", "Сегодня"],
                ["tomorrow", "Завтра"],
                ["nextWeek", "На след. неделе"],
                ["none", "Без срока"],
              ] as const
            ).map(([choice, label]) => (
              <button
                key={choice}
                type="button"
                className={`picker-chip${dueChoice === choice ? " active" : ""}`}
                onClick={() => setDueChoice(choice)}
              >
                {label}
              </button>
            ))}
          </div>

          <button className="mark-complete-btn incomplete" type="submit" disabled={saving || !title.trim()}>
            {saving ? "Сохраняем…" : "Создать"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function MobileApp({ userId, email }: { userId: string; email: string | null }) {
  const [tab, setTab] = useState<MobileTab>("home");
  const [boards, setBoards] = useState<Board[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [shareBoard, setShareBoard] = useState<Board | null>(null);
  const [backgroundBoard, setBackgroundBoard] = useState<Board | null>(null);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("unsubscribed");
  const [pushBusy, setPushBusy] = useState(false);

  const load = useCallback(async () => {
    const [boardsRes, listsRes, cardsRes, checklistRes, attachmentsRes, membersRes] = await Promise.all([
      supabase.from("boards").select("*").order("updated_at", { ascending: false }),
      supabase.from("lists").select("*").order("position", { ascending: true }),
      supabase.from("cards").select("*").order("position", { ascending: true }),
      supabase.from("checklist_items").select("*"),
      supabase.from("attachments").select("id, card_id"),
      supabase.from("board_members").select("*"),
    ]);
    setBoards((boardsRes.data as Board[] | null) ?? []);
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
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("mobile-app")
      .on("postgres_changes", { event: "*", schema: "public", table: "boards" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "lists" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "checklist_items" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "attachments" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_members" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    if (isPushSupported()) getPushStatus().then(setPushStatus);
  }, []);

  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);

  const progressByCard = useMemo(() => {
    const map: Record<string, Progress> = {};
    for (const item of checklistItems) {
      const p = (map[item.card_id] ??= { done: 0, total: 0 });
      p.total += 1;
      if (item.is_done) p.done += 1;
    }
    return map;
  }, [checklistItems]);

  const progressByBoard = useMemo(() => {
    const map: Record<string, Progress> = {};
    for (const card of cards) {
      const p = (map[card.board_id] ??= { done: 0, total: 0 });
      p.total += 1;
      if (card.is_done) p.done += 1;
    }
    return map;
  }, [cards]);

  const selectedCardLists = selectedCard ? lists.filter((l) => l.board_id === selectedCard.board_id) : [];
  const selectedCardMembers = selectedCard ? members.filter((m) => m.board_id === selectedCard.board_id) : [];
  const shareBoardMembership = shareBoard ? members.find((m) => m.board_id === shareBoard.id && m.user_id === userId) : null;

  async function toggleCardDone(card: Card) {
    const next = !card.is_done;
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, is_done: next } : c)));
    await supabase.from("cards").update({ is_done: next }).eq("id", card.id);
  }

  async function createBoard(name: string) {
    const { data, error } = await supabase.rpc("create_board", { p_name: name });
    if (error || !data) return;
    const board = data as Board;
    await supabase.from("lists").insert({ board_id: board.id, title: "Входящие", position: 0 });
    load();
  }

  async function handleTogglePush() {
    setPushBusy(true);
    if (pushStatus === "subscribed") {
      await disablePush();
      setPushStatus("unsubscribed");
    } else {
      const result = await enablePush();
      if (result.ok) setPushStatus("subscribed");
    }
    setPushBusy(false);
  }

  if (loading) return <div className="spinner-screen">Загрузка…</div>;

  return (
    <div className="mobile-app-shell">
      <div className="topbar">
        <div className="brand">
          <Logo />
        </div>
      </div>

      {tab === "home" && (
        <HomeTab
          cards={cards}
          boardById={boardById}
          members={members}
          progressByCard={progressByCard}
          attachmentCounts={attachmentCounts}
          projectFilter={projectFilter}
          onClearFilter={() => setProjectFilter(null)}
          onOpenCard={setSelectedCard}
          onToggleDone={toggleCardDone}
        />
      )}
      {tab === "projects" && (
        <ProjectsTab
          boards={boards}
          progressByBoard={progressByBoard}
          onSelectProject={(boardId) => {
            setProjectFilter(boardId);
            setTab("home");
          }}
          onShareBoard={setShareBoard}
          onBackgroundBoard={setBackgroundBoard}
          onCreateBoard={createBoard}
        />
      )}
      {tab === "calendar" && (
        <CalendarTab
          cards={cards}
          boardById={boardById}
          members={members}
          progressByCard={progressByCard}
          attachmentCounts={attachmentCounts}
          onOpenCard={setSelectedCard}
          onToggleDone={toggleCardDone}
        />
      )}
      {tab === "profile" && (
        <ProfileTab
          email={email}
          pushStatus={pushStatus}
          pushBusy={pushBusy}
          onTogglePush={handleTogglePush}
          onOpenAiSettings={() => setAiSettingsOpen(true)}
          onSignOut={() => supabase.auth.signOut()}
        />
      )}

      {(tab === "home" || tab === "projects") && boards.length > 0 && (
        <button type="button" className="fab" onClick={() => setNewCardOpen(true)} aria-label="Новая задача">
          +
        </button>
      )}

      <BottomTabBar tab={tab} onChange={setTab} />

      {newCardOpen && (
        <NewCardModal
          boards={boards}
          lists={lists}
          defaultBoardId={projectFilter}
          onClose={() => setNewCardOpen(false)}
          onCreated={load}
        />
      )}

      {selectedCard && (
        <CardModal
          card={cards.find((c) => c.id === selectedCard.id) ?? selectedCard}
          members={selectedCardMembers}
          lists={selectedCardLists}
          onClose={() => setSelectedCard(null)}
          onChanged={load}
          onDeleted={() => {
            setSelectedCard(null);
            load();
          }}
        />
      )}

      {shareBoard && (
        <ShareModal
          boardId={shareBoard.id}
          currentUserId={userId}
          isOwner={shareBoardMembership?.role === "owner"}
          onClose={() => setShareBoard(null)}
        />
      )}

      {backgroundBoard && (
        <BackgroundModal
          boardId={backgroundBoard.id}
          current={backgroundBoard.background}
          currentImagePath={backgroundBoard.background_image_path}
          onClose={() => setBackgroundBoard(null)}
          onChanged={load}
        />
      )}

      {aiSettingsOpen && <AISettingsModal onClose={() => setAiSettingsOpen(false)} />}
    </div>
  );
}
