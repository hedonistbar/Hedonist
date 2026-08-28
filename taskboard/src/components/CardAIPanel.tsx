import { useEffect, useRef, useState, type FormEvent } from "react";
import { Document, Packer, Paragraph } from "docx";
import { ATTACHMENTS_BUCKET, supabase } from "../lib/supabase";
import { extractListItems, loadAiMessages, sendAiMessage } from "../lib/ai";
import type { AiMessage, ChecklistItem } from "../lib/database.types";

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const QUICK_PROMPTS = [
  { label: "📋 План проекта", prompt: "Составь подробный план по этой задаче: этапы, что нужно сделать на каждом, примерные сроки." },
  { label: "✉️ Черновик письма", prompt: "Напиши черновик письма по теме этой карточки. Если не хватает деталей (кому, о чём именно) — сначала спроси." },
  { label: "✅ Чек-лист шагов", prompt: "Разбей эту задачу на конкретные шаги списком, чтобы я мог превратить их в чек-лист." },
];

export function CardAIPanel({
  cardId,
  boardId,
  checklistLength,
  onChecklistAdded,
  onDescriptionReplaced,
}: {
  cardId: string;
  boardId: string;
  checklistLength: number;
  onChecklistAdded: () => void;
  onDescriptionReplaced: (text: string) => void;
}) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    loadAiMessages(cardId).then(setMessages);

    const channel = supabase
      .channel(`ai-messages-${cardId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_messages", filter: `card_id=eq.${cardId}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as AiMessage).id) ? prev : [...prev, payload.new as AiMessage],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cardId, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setInput("");
    // optimistic user bubble — the realtime insert will dedupe against this
    // once the server round-trip lands, but showing it immediately avoids a
    // laggy feel while waiting on Claude's reply.
    const optimistic: AiMessage = {
      id: `optimistic-${Date.now()}`,
      board_id: boardId,
      card_id: cardId,
      role: "user",
      content: trimmed,
      created_by: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const reply = await sendAiMessage(cardId, trimmed);
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), reply]);
      // re-sync so the real user-message row (with its real id) replaces the optimistic one
      loadAiMessages(cardId).then(setMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось получить ответ ИИ.");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  async function addToChecklist(message: AiMessage) {
    const items = extractListItems(message.content);
    if (items.length === 0) return;
    setBusyMessageId(message.id);
    let position = checklistLength;
    const rows = items.map((text) => ({ board_id: boardId, card_id: cardId, text, position: position++ }));
    await supabase.from("checklist_items").insert(rows as Partial<ChecklistItem>[]);
    setBusyMessageId(null);
    onChecklistAdded();
  }

  async function attachAsFile(message: AiMessage) {
    setBusyMessageId(message.id);
    const fileName = `ии-ответ-${new Date(message.created_at).toISOString().slice(0, 10)}.docx`;
    const path = `${boardId}/${cardId}/${crypto.randomUUID()}-${fileName}`;
    // A real .docx (not .txt) so it fits alongside the card's other
    // documents (contracts, translations) and opens directly in Word.
    const doc = new Document({
      sections: [
        {
          children: message.content.split("\n").map((line) => new Paragraph(line)),
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    const { error: uploadError } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, blob);
    if (!uploadError) {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("attachments").insert({
        board_id: boardId,
        card_id: cardId,
        file_name: fileName,
        storage_path: path,
        content_type: DOCX_CONTENT_TYPE,
        size_bytes: blob.size,
        uploaded_by: userData.user?.id ?? null,
      });
    }
    setBusyMessageId(null);
    onChecklistAdded();
  }

  function applyAsDescription(message: AiMessage) {
    onDescriptionReplaced(message.content);
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost ai-toggle-btn" onClick={() => setOpen(true)}>
        ✨ ИИ-ассистент
      </button>
    );
  }

  return (
    <div className="field ai-panel">
      <label>✨ ИИ-ассистент</label>

      <div className="ai-messages" ref={listRef}>
        {messages.length === 0 && (
          <p className="sub ai-empty">
            Опишите, что нужно сделать по этой карточке — план, письмо, разбивку на шаги. Видит и вложения (текстовые
            файлы, PDF, изображения, документы Word/.docx) — можно спросить про их содержимое. Ответ можно одним
            кликом превратить в чек-лист, сохранить как .docx-файл карточки или сделать описанием карточки.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`ai-bubble ai-bubble-${m.role}`}>
            <div className="ai-bubble-text">{m.content}</div>
            {m.role === "assistant" && (
              <div className="ai-bubble-actions">
                {extractListItems(m.content).length > 0 && (
                  <button type="button" className="link-btn" disabled={busyMessageId === m.id} onClick={() => addToChecklist(m)}>
                    + в чек-лист
                  </button>
                )}
                <button type="button" className="link-btn" disabled={busyMessageId === m.id} onClick={() => attachAsFile(m)}>
                  сохранить как .docx
                </button>
                <button type="button" className="link-btn" disabled={busyMessageId === m.id} onClick={() => applyAsDescription(m)}>
                  как описание
                </button>
              </div>
            )}
          </div>
        ))}
        {sending && <div className="ai-bubble ai-bubble-assistant ai-thinking">Думаю…</div>}
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="ai-quick-prompts">
        {QUICK_PROMPTS.map((qp) => (
          <button type="button" key={qp.label} className="pill ai-quick-prompt" disabled={sending} onClick={() => send(qp.prompt)}>
            {qp.label}
          </button>
        ))}
      </div>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          placeholder="Спросите ИИ об этой карточке…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button className="btn btn-primary" type="submit" disabled={sending || !input.trim()}>
          {sending ? "…" : "Отправить"}
        </button>
      </form>
    </div>
  );
}
