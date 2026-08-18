import { isOwner, type BotContext } from "../context.js";

export async function helpCommand(ctx: BotContext) {
  const lines = [
    "Доступні команди:",
    "/status — стан закладу та стоп-крану",
    "/pause [причина] — увімкнути стоп-кран (зупинити всі автодії)",
    "/resume — зняти стоп-кран",
    "/whoami — ваш telegram_id та роль",
  ];
  if (ctx.restaurantUser && isOwner(ctx)) {
    lines.push("/add_admin <telegram_id> [ім'я] — додати адміністратора");
  }
  await ctx.reply(lines.join("\n"));
}
