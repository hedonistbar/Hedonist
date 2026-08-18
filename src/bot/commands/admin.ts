import { createRestaurantUser, findRestaurantUser, logActivity } from "../../db/repo.js";
import { isOwner, type BotContext } from "../context.js";
import { roleLabel } from "./start.js";

export async function addAdminCommand(ctx: BotContext) {
  if (!isOwner(ctx)) {
    await ctx.reply("Тільки власник може додавати адміністраторів.");
    return;
  }

  const arg = ctx.match?.toString().trim();
  const telegramUserId = Number(arg?.split(/\s+/)[0]);
  if (!arg || !Number.isFinite(telegramUserId)) {
    await ctx.reply(
      "Формат: /add_admin <telegram_id> [ім'я]\n" +
        "Telegram ID можна дізнатись, попросивши людину написати /whoami цьому боту."
    );
    return;
  }

  const displayName = arg.split(/\s+/).slice(1).join(" ") || null;
  const existing = await findRestaurantUser(ctx.restaurant.id, telegramUserId);
  if (existing) {
    await ctx.reply(`Цей користувач вже підключений як ${roleLabel(existing.role)}.`);
    return;
  }

  await createRestaurantUser(ctx.restaurant.id, telegramUserId, "admin", displayName);
  await logActivity(ctx.restaurant.id, String(ctx.from?.id), "admin_added", {
    telegram_user_id: telegramUserId,
    display_name: displayName,
  });

  await ctx.reply(`Адміністратора додано (telegram_id: ${telegramUserId}).`);
}

export async function whoamiCommand(ctx: BotContext) {
  if (!ctx.restaurantUser) {
    await ctx.reply(`Ваш telegram_id: ${ctx.from?.id}\nАкаунт не підключено до жодного закладу.`);
    return;
  }
  await ctx.reply(
    `telegram_id: ${ctx.from?.id}\n` +
      `Заклад: ${ctx.restaurant.name}\n` +
      `Роль: ${roleLabel(ctx.restaurantUser.role)}`
  );
}
