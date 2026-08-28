import { useEffect, useRef, useState, type FormEvent } from "react";
import { ATTACHMENTS_BUCKET, supabase } from "../lib/supabase";
import { dueUrgency } from "../lib/dueUrgency";
import { notifyCardAssigned } from "../lib/push";
import { CardAIPanel } from "./CardAIPanel";
import { swatchColor } from "../lib/swatchColor";
import { triggerSparkleBurst } from "../lib/sparkle";
import type { Attachment, BoardMember, Card, ChecklistItem, List } from "../lib/database.types";

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CardModal({
  card,
  members,
  lists,
  onClose,
  onChanged,
  onDeleted,
}: {
  card: Card;
  members: BoardMember[];
  lists: List[];
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [dueDate, setDueDate] = useState(toDatetimeLocal(card.due_date));
  const [isDone, setIsDone] = useState(card.is_done);
  const [assignedTo, setAssignedTo] = useState(card.assigned_to ?? "");
  const [listId, setListId] = useState(card.list_id);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadChecklist() {
    const { data } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("card_id", card.id)
      .order("position", { ascending: true });
    setChecklist((data as ChecklistItem[] | null) ?? []);
  }

  async function loadAttachments() {
    const { data } = await supabase
      .from("attachments")
      .select("*")
      .eq("card_id", card.id)
      .order("created_at", { ascending: true });
    setAttachments((data as Attachment[] | null) ?? []);
  }

  useEffect(() => {
    loadChecklist();
    loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  async function saveField(patch: Partial<Card>) {
    setError(null);
    const { error: updateError } = await supabase.from("cards").update(patch).eq("id", card.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onChanged();
  }

  async function toggleDone() {
    const next = !isDone;
    setIsDone(next);
    await saveField({ is_done: next });
  }

  async function addChecklistItem(e: FormEvent) {
    e.preventDefault();
    const text = newItemText.trim();
    if (!text) return;
    const position = checklist.length ? Math.max(...checklist.map((i) => i.position)) + 1 : 0;
    setNewItemText("");
    const { error: insertError } = await supabase
      .from("checklist_items")
      .insert({ board_id: card.board_id, card_id: card.id, text, position });
    if (insertError) setError(insertError.message);
    loadChecklist();
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    await supabase.from("checklist_items").update({ is_done: !item.is_done }).eq("id", item.id);
    loadChecklist();
  }

  async function deleteChecklistItem(item: ChecklistItem) {
    await supabase.from("checklist_items").delete().eq("id", item.id);
    loadChecklist();
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    const path = `${card.board_id}/${card.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("attachments").insert({
      board_id: card.board_id,
      card_id: card.id,
      file_name: file.name,
      storage_path: path,
      content_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userData.user?.id ?? null,
    });
    setUploading(false);
    loadAttachments();
  }

  async function downloadAttachment(a: Attachment) {
    const { data } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(a.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  async function deleteAttachment(a: Attachment) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([a.storage_path]);
    await supabase.from("attachments").delete().eq("id", a.id);
    loadAttachments();
  }

  async function deleteCard() {
    if (!confirm("Удалить карточку без возможности восстановления?")) return;
    await supabase.from("cards").delete().eq("id", card.id);
    onDeleted();
  }

  async function changeAssignee(userId: string) {
    setAssignedTo(userId);
    await saveField({ assigned_to: userId || null });
    if (userId) notifyCardAssigned(card.id);
  }

  async function changeList(nextListId: string) {
    setListId(nextListId);
    await saveField({ list_id: nextListId });
  }

  async function applyAiDescription(text: string) {
    setDescription(text);
    await saveField({ description: text });
  }

  const doneCount = checklist.filter((i) => i.is_done).length;
  const urgency = dueUrgency(card.due_date, isDone);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-modal-header">
          <button className="text-link-muted" onClick={onClose}>
            Закрыть
          </button>
          <button className="text-link-danger" onClick={deleteCard}>
            Удалить
          </button>
        </div>

        {error && <div className="error-text">{error}</div>}

        <input
          className="card-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== card.title && saveField({ title: title.trim() })}
        />

        <button
          type="button"
          className={`mark-complete-btn${isDone ? " complete" : " incomplete"}`}
          onClick={(e) => {
            if (!isDone) triggerSparkleBurst(e.clientX, e.clientY);
            toggleDone();
          }}
        >
          {isDone ? "Отметить как невыполненную" : "Отметить как выполненную"}
        </button>

        <div className="info-card">
          <div className="info-row">
            <span className="info-row-label">Список</span>
            <span className="info-row-value-group">
              <span className="info-row-dot" style={{ background: swatchColor(listId) }} />
              <select className="info-row-select" value={listId} onChange={(e) => changeList(e.target.value)}>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div className="info-row">
            <span className="info-row-label">Срок</span>
            <input
              type="datetime-local"
              value={dueDate}
              className={`info-row-input${urgency ? ` urgency-${urgency}` : ""}`}
              onChange={(e) => {
                setDueDate(e.target.value);
                saveField({ due_date: e.target.value ? new Date(e.target.value).toISOString() : null });
              }}
            />
          </div>
          <div className="info-row">
            <span className="info-row-label">Исполнитель</span>
            <select className="info-row-select" value={assignedTo} onChange={(e) => changeAssignee(e.target.value)}>
              <option value="">Не назначен</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name ?? m.user_id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="section-label">Заметки</div>
        <textarea
          rows={4}
          placeholder="Нет заметок — добавьте подробности…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (card.description ?? "") && saveField({ description: description || null })}
        />

        <CardAIPanel
          cardId={card.id}
          boardId={card.board_id}
          checklistLength={checklist.length}
          onChecklistAdded={() => {
            loadChecklist();
            loadAttachments();
          }}
          onDescriptionReplaced={applyAiDescription}
        />

        <div className="field">
          <div className="section-label">
            Чек-лист {checklist.length > 0 && `(${doneCount}/${checklist.length})`}
          </div>
          {checklist.length > 0 && (
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${(doneCount / checklist.length) * 100}%` }}
              />
            </div>
          )}
          <div className="checklist">
            {checklist.map((item) => (
              <div className="checklist-item" key={item.id}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={item.is_done} onChange={() => toggleChecklistItem(item)} />
                  <span className={item.is_done ? "done" : ""}>{item.text}</span>
                </label>
                <button className="link-btn" style={{ padding: 0 }} onClick={() => deleteChecklistItem(item)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <form className="inline-form" onSubmit={addChecklistItem}>
            <input
              placeholder="Добавить пункт…"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
            />
            <button className="btn btn-ghost" type="submit" disabled={!newItemText.trim()}>
              Добавить
            </button>
          </form>
        </div>

        <div className="field">
          <div className="section-label">Вложения</div>
          <div className="attachments">
            {attachments.map((a) => (
              <div className="attachment-row" key={a.id}>
                <button className="link-btn" style={{ padding: 0, textAlign: "left" }} onClick={() => downloadAttachment(a)}>
                  📎 {a.file_name}
                </button>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="sub" style={{ marginBottom: 0 }}>
                    {formatSize(a.size_bytes)}
                  </span>
                  <button className="link-btn" style={{ padding: 0 }} onClick={() => deleteAttachment(a)}>
                    удалить
                  </button>
                </span>
              </div>
            ))}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              for (const file of files) {
                await uploadFile(file);
              }
            }}
          />
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Загружаем…" : "+ Прикрепить файлы"}
          </button>
        </div>
      </div>
    </div>
  );
}
