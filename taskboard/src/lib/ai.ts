import { supabase } from "./supabase";
import type { AiMessage } from "./database.types";

export async function loadAiMessages(cardId: string): Promise<AiMessage[]> {
  const { data } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at", { ascending: true });
  return (data as AiMessage[] | null) ?? [];
}

/** Sends a message to the card's AI assistant and returns Claude's reply. */
export async function sendAiMessage(cardId: string, message: string): Promise<AiMessage> {
  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: { card_id: cardId, message },
  });
  if (error) {
    // supabase-js only exposes the parsed body on FunctionsHttpError.context
    const context = (error as { context?: Response }).context;
    const body = context ? await context.json().catch(() => null) : null;
    throw new Error(body?.error ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data.message as AiMessage;
}

export async function hasAnthropicApiKey(): Promise<boolean> {
  const { data } = await supabase.rpc("has_anthropic_api_key");
  return Boolean(data);
}

export async function setAnthropicApiKey(key: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("set_anthropic_api_key", { p_key: key });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Very small parser: pulls out list items from a Claude reply so they can
 * become real checklist rows — lines starting with -, *, • or "1." etc. */
export function extractListItems(text: string): string[] {
  const listLine = /^([-*•]|\d+[.)])\s+/;
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => listLine.test(line))
    .map((line) => line.replace(listLine, "").replace(/^\[[ xX]\]\s*/, "").trim())
    .filter((line) => line.length > 0);
}
