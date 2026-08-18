import { createRestaurantUser, getRestaurantUsers, logActivity } from "../../db/repo.js";
import type { BotContext } from "../context.js";

export async function startCommand(ctx: BotContext) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  if (ctx.restaurantUser) {
    await ctx.reply(
      `З поверненням, ${ctx.restaurantUser.display_name ?? "друже"}! ` +
        `Ви — ${roleLabel(ctx.restaurantUser.role)} у "${ctx.restaurant.name}".\n\n` +
        `Команди: /status /pause /resume /help`
    );
    return;
  }

  // Bootstrap: the first person to /start on a restaurant with no owner yet becomes the owner.
  const existingUsers = await getRestaurantUsers(ctx.restaurant.id);
  const hasOwner = existingUsers.some((u) => u.role === "owner");

  if (!hasOwner) {
    const displayName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || null;
    const user = await createRestaurantUser(ctx.restaurant.id, telegramUserId, "owner", displayName);
    ctx.restaurantUser = user;
    await logActivity(ctx.restaurant.id, String(telegramUserId), "owner_registered", {
      display_name: displayName,
    });
    await ctx.reply(
      `Вітаю! Вас зареєстровано як власника "${ctx.restaurant.name}".\n\n` +
        `Щоб додати адміністратора для обробки ескалацій з інбоксу, використайте /add_admin <telegram_id>.\n\n` +
        `Команди: /status /pause /resume /add_admin /whoami /help`
    );
    return;
  }

  await ctx.reply(
    `Вітаю! Цей бот керує "${ctx.restaurant.name}". ` +
      `Ваш акаунт ще не підключено — попросіть власника додати вас командою /add_admin ${telegramUserId}.`
  );
}

export function roleLabel(role: "owner" | "admin"): string {
  return role === "owner" ? "власник" : "адміністратор";
}
