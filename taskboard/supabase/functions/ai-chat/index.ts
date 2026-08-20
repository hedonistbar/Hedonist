import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// The AI assistant embedded in each card. Uses the caller's own JWT (anon
// key) to look up the card and its board — RLS naturally scopes this to
// boards the caller is a member of, so a stray card_id from another board
// just 404s instead of leaking data. The Anthropic call itself uses the
// service role, since the API key lives in Vault and is never exposed to
// clients.
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing Authorization" }), { status: 401 });
  }

  let card_id: string | undefined;
  let message: string | undefined;
  try {
    ({ card_id, message } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), { status: 400 });
  }
  if (!card_id || !message?.trim()) {
    return new Response(JSON.stringify({ error: "card_id and message are required" }), { status: 400 });
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
    return new Response(JSON.stringify({ error: cardError?.message ?? "card not found" }), { status: 404 });
  }

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
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

  // Save the user's message first so it's visible even if the Anthropic
  // call below fails.
  const { error: insertUserError } = await userClient
    .from("ai_messages")
    .insert({ board_id: card.board_id, card_id, role: "user", content: message, created_by: user.id });
  if (insertUserError) {
    return new Response(JSON.stringify({ error: insertUserError.message }), { status: 500 });
  }

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: apiKey, error: keyError } = await serviceClient.rpc("get_anthropic_api_key");
  if (keyError || !apiKey) {
    return new Response(
      JSON.stringify({ error: "Anthropic API-ключ не настроен. Задайте его в настройках (значок ИИ)." }),
      { status: 412 },
    );
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
  ]
    .filter(Boolean)
    .join("\n");

  const messages = [
    ...((history ?? []) as { role: string; content: string }[]).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
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
    return new Response(JSON.stringify({ error: `Anthropic API: ${anthropicRes.status} ${text}` }), { status: 502 });
  }

  const anthropicJson = await anthropicRes.json();
  const reply = (anthropicJson.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();

  if (!reply) {
    return new Response(JSON.stringify({ error: "empty response from Anthropic" }), { status: 502 });
  }

  const { data: saved, error: insertAssistantError } = await serviceClient
    .from("ai_messages")
    .insert({ board_id: card.board_id, card_id, role: "assistant", content: reply })
    .select()
    .single();
  if (insertAssistantError) {
    return new Response(JSON.stringify({ error: insertAssistantError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ message: saved }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
