import type { NextFunction } from "grammy";
import { loadEnv } from "../../config/env.js";
import { findRestaurantUser, getRestaurantBySlug } from "../../db/repo.js";
import type { BotContext } from "../context.js";

// Phase 0: one Telegram bot instance serves one restaurant, selected by
// DEFAULT_RESTAURANT_SLUG. A real multi-tenant deployment would route by
// bot token or a /switch command instead of a single env-configured slug.
export async function tenantMiddleware(ctx: BotContext, next: NextFunction) {
  const env = loadEnv();
  const restaurant = await getRestaurantBySlug(env.DEFAULT_RESTAURANT_SLUG);
  if (!restaurant) {
    await ctx.reply(
      `Ресторан "${env.DEFAULT_RESTAURANT_SLUG}" не знайдено в базі. Спочатку виконайте сідінг (npm run seed).`
    );
    return;
  }
  ctx.restaurant = restaurant;

  const telegramUserId = ctx.from?.id;
  ctx.restaurantUser = telegramUserId
    ? await findRestaurantUser(restaurant.id, telegramUserId)
    : null;

  await next();
}
