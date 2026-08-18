import { getSettings } from "../../db/repo.js";
import type { BotContext } from "../context.js";

export async function statusCommand(ctx: BotContext) {
  if (!ctx.restaurantUser) {
    await ctx.reply("Ваш акаунт не підключено. Використайте /start.");
    return;
  }

  const settings = await getSettings(ctx.restaurant.id);
  const pauseLine = ctx.restaurant.is_paused
    ? `🔴 СТОП-КРАН УВІМКНЕНО${ctx.restaurant.paused_reason ? ` (${ctx.restaurant.paused_reason})` : ""}\n` +
      `   з ${ctx.restaurant.paused_at ? new Date(ctx.restaurant.paused_at).toLocaleString("uk-UA") : "?"}`
    : "🟢 Працює в штатному режимі";

  const alertLine = settings?.alert_mode
    ? "⚠️ Режим підвищеної обережності: усі авто-відповіді йдуть тільки через ручне підтвердження."
    : "Режим підвищеної обережності: вимкнено.";

  await ctx.reply(
    [
      `Заклад: ${ctx.restaurant.name}`,
      `Часовий пояс: ${ctx.restaurant.timezone}`,
      "",
      pauseLine,
      alertLine,
      "",
      `Авто-відповіді в інбоксі: ${settings?.auto_reply_enabled ? "увімкнено" : "вимкнено"}`,
    ].join("\n")
  );
}
