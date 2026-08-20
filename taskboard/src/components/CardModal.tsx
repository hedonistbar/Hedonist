import { useEffect, useRef, useState, type FormEvent } from "react";
import { ATTACHMENTS_BUCKET, supabase } from "../lib/supabase";
import type { Attachment, Card, ChecklistItem } from "../lib/database.types";

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
  onClose,
  onChanged,
  onDeleted,
}: {
  card: Card;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [dueDate, setDueDate] = useState(toDatetimeLocal(card.due_date));
  const [isDone, setIsDone] = useState(card.is_done);
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

  const doneCount = checklist.filter((i) => i.is_done).length;
  const overdue = card.due_date && !isDone && new Date(card.due_date) < new Date();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <label className="checkbox-label" style={{ marginRight: 8 }}>
            <input type="checkbox" checked={isDone} onChange={toggleDone} />
          </label>
          <input
            className="card-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== card.title && saveField({ title: title.trim() })}
          />
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="error-text">{error}</div>}

        <div className="field">
          <label htmlFor="due-date">Срок</label>
          <input
            id="due-date"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              saveField({ due_date: e.target.value ? new Date(e.target.value).toISOString() : null });
            }}
            style={overdue ? { borderColor: "var(--overdue)", color: "var(--overdue)" } : undefined}
          />
        </div>

        <div className="field">
          <label htmlFor="description">Описание</label>
          <textarea
            id="description"
            rows={4}
            placeholder="Подробности…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (card.description ?? "") && saveField({ description: description || null })}
          />
        </div>

        <div className="field">
          <label>
            Чек-лист {checklist.length > 0 && `(${doneCount}/${checklist.length})`}
          </label>
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
          <label>Вложения</label>
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
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = "";
            }}
          />
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Загружаем…" : "+ Прикрепить файл"}
          </button>
        </div>

        <button className="btn btn-danger" onClick={deleteCard} style={{ marginTop: 8 }}>
          Удалить карточку
        </button>
      </div>
    </div>
  );
}
