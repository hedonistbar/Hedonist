import { logActivity, setRestaurantPaused } from "../../db/repo.js";
import { isOwnerOrAdmin, type BotContext } from "../context.js";

export async function pauseCommand(ctx: BotContext) {
  if (!isOwnerOrAdmin(ctx)) {
    await ctx.reply("Тільки власник або адміністратор можуть активувати стоп-кран.");
    return;
  }

  const reason = ctx.match?.toString().trim() || null;
  await setRestaurantPaused(ctx.restaurant.id, true, reason);
  await logActivity(ctx.restaurant.id, String(ctx.from?.id), "stop_crane_activated", { reason });

  await ctx.reply(
    "🔴 Стоп-кран увімкнено. Публікації, автопостинг та авто-відповіді в інбоксі зупинено.\n" +
      "Система продовжує накопичувати чернетки, але нічого не публікує й не відповідає автоматично.\n\n" +
      "Щоб відновити роботу: /resume"
  );
}

export async function resumeCommand(ctx: BotContext) {
  if (!isOwnerOrAdmin(ctx)) {
    await ctx.reply("Тільки власник або адміністратор можуть зняти стоп-кран.");
    return;
  }

  await setRestaurantPaused(ctx.restaurant.id, false, null);
  await logActivity(ctx.restaurant.id, String(ctx.from?.id), "stop_crane_deactivated", {});

  await ctx.reply("🟢 Стоп-кран знято. Система повертається до штатного режиму роботи.");
}
