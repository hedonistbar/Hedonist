import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";

const ATTACHMENTS_BUCKET = "attachments";
const MAX_ATTACHMENTS = 4;
const MAX_TEXT_CHARS = 8000;
const MAX_BINARY_BYTES = 4 * 1024 * 1024; // 4MB — keeps the request payload sane

function isTextLike(contentType: string | null, fileName: string): boolean {
  if (contentType?.startsWith("text/") || contentType === "application/json") return true;
  return /\.(txt|md|csv|json|log)$/i.test(fileName);
}

// Browsers preflight any cross-origin request carrying a custom
// Authorization header, so the OPTIONS branch below and these headers on
// every response are required — without them the actual POST never leaves
// the browser (surfaces client-side as an opaque "failed to fetch").
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// The AI assistant embedded in each card. Uses the caller's own JWT (anon
// key) to look up the card and its board — RLS naturally scopes this to
// boards the caller is a member of, so a stray card_id from another board
// just 404s instead of leaking data. The Anthropic call itself uses the
// service role, since the API key lives in Vault and is never exposed to
// clients.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "missing Authorization" }, 401);
  }

  let card_id: string | undefined;
  let message: string | undefined;
  try {
    ({ card_id, message } = await req.json());
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!card_id || !message?.trim()) {
    return json({ error: "card_id and message are required" }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: card, error: cardError } = await userClient
    .from("cards")
    .select("id, board_id, title, description, due_date, is_done, boards(name)")
    .eq("id", card_id)
    .maybeSingle();
  if (cardError || !card) {
    return json({ error: cardError?.message ?? "card not found" }, 404);
  }

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return json({ error: "unauthorized" }, 401);
  }

  const { data: checklist } = await userClient
    .from("checklist_items")
    .select("text, is_done")
    .eq("card_id", card_id)
    .order("position", { ascending: true });

  const { data: history } = await userClient
    .from("ai_messages")
    .select("role, content")
    .eq("card_id", card_id)
    .order("created_at", { ascending: true })
    .limit(30);

  const { data: attachments } = await userClient
    .from("attachments")
    .select("file_name, storage_path, content_type, size_bytes")
    .eq("card_id", card_id)
    .order("created_at", { ascending: false })
    .limit(MAX_ATTACHMENTS);

  const attachmentTexts: string[] = [];
  const attachmentBlocks: Record<string, unknown>[] = [];
  const attachmentNotes: string[] = [];

  for (const a of (attachments ?? []) as { file_name: string; storage_path: string; content_type: string | null; size_bytes: number | null }[]) {
    if (isTextLike(a.content_type, a.file_name)) {
      const { data: blob } = await userClient.storage.from(ATTACHMENTS_BUCKET).download(a.storage_path);
      if (blob) {
        const text = new TextDecoder().decode(await blob.arrayBuffer()).slice(0, MAX_TEXT_CHARS);
        attachmentTexts.push(`Файл «${a.file_name}»:\n${text}`);
      }
      continue;
    }
    if ((a.size_bytes ?? 0) > MAX_BINARY_BYTES) {
      attachmentNotes.push(`«${a.file_name}» — слишком большой файл, не читаю содержимое.`);
      continue;
    }
    if (a.content_type === "application/pdf") {
      const { data: blob } = await userClient.storage.from(ATTACHMENTS_BUCKET).download(a.storage_path);
      if (blob) {
        const base64 = encodeBase64(await blob.arrayBuffer());
        attachmentBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        });
        attachmentNotes.push(`«${a.file_name}» — приложен как документ, можно ссылаться на его содержимое.`);
      }
      continue;
    }
    if (a.content_type?.startsWith("image/")) {
      const { data: blob } = await userClient.storage.from(ATTACHMENTS_BUCKET).download(a.storage_path);
      if (blob) {
        const base64 = encodeBase64(await blob.arrayBuffer());
        attachmentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: a.content_type, data: base64 },
        });
        attachmentNotes.push(`«${a.file_name}» — приложено как изображение, можно его описать/проанализировать.`);
      }
      continue;
    }
    attachmentNotes.push(`«${a.file_name}» (${a.content_type ?? "неизвестный тип"}) — прикреплён, но этот тип файла я читать не умею.`);
  }

  // Save the user's message first so it's visible even if the Anthropic
  // call below fails.
  const { error: insertUserError } = await userClient
    .from("ai_messages")
    .insert({ board_id: card.board_id, card_id, role: "user", content: message, created_by: user.id });
  if (insertUserError) {
    return json({ error: insertUserError.message }, 500);
  }

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: apiKey, error: keyError } = await serviceClient.rpc("get_anthropic_api_key");
  if (keyError || !apiKey) {
    return json({ error: "Anthropic API-ключ не настроен. Задайте его в настройках (значок ИИ)." }, 412);
  }

  const boardName = Array.isArray(card.boards) ? card.boards[0]?.name : (card.boards as { name?: string } | null)?.name;
  const checklistText = (checklist ?? [])
    .map((i: { text: string; is_done: boolean }) => `- [${i.is_done ? "x" : " "}] ${i.text}`)
    .join("\n");

  const systemPrompt = [
    "Ты — ИИ-ассистент внутри карточки таск-менеджера Ivchenko Hub (похож на Trello).",
    "Помогаешь довести конкретную карточку/задачу до результата: пишешь письма, планы проектов, тексты документов, разбиваешь задачу на шаги.",
    "Отвечай на языке, на котором пишет пользователь (по умолчанию — русский). Пиши по делу, без лишних вступлений.",
    "Когда уместно, форматируй ответ так, чтобы его было легко превратить в чек-лист (маркированный/нумерованный список) или сохранить как отдельный файл (письмо, документ) — пользователь может сделать это одним кликом после твоего ответа.",
    "",
    `Доска: ${boardName ?? "—"}`,
    `Карточка: ${card.title}`,
    card.description ? `Описание: ${card.description}` : null,
    card.due_date ? `Срок: ${new Date(card.due_date as string).toLocaleString("ru-RU")}` : null,
    checklistText ? `Чек-лист:\n${checklistText}` : null,
    attachmentNotes.length ? `Вложения карточки:\n${attachmentNotes.map((n) => `- ${n}`).join("\n")}` : null,
    attachmentTexts.length ? `Содержимое текстовых вложений:\n\n${attachmentTexts.join("\n\n---\n\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const lastUserContent = attachmentBlocks.length
    ? [{ type: "text", text: message }, ...attachmentBlocks]
    : message;

  const messages = [
    ...((history ?? []) as { role: string; content: string }[]).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: lastUserContent },
  ];

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    }),
  });

  if (!anthropicRes.ok) {
    const text = await anthropicRes.text().catch(() => "");
    return json({ error: `Anthropic API: ${anthropicRes.status} ${text}` }, 502);
  }

  const anthropicJson = await anthropicRes.json();
  const reply = (anthropicJson.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();

  if (!reply) {
    return json({ error: "empty response from Anthropic" }, 502);
  }

  const { data: saved, error: insertAssistantError } = await serviceClient
    .from("ai_messages")
    .insert({ board_id: card.board_id, card_id, role: "assistant", content: reply })
    .select()
    .single();
  if (insertAssistantError) {
    return json({ error: insertAssistantError.message }, 500);
  }

  return json({ message: saved }, 200);
});
