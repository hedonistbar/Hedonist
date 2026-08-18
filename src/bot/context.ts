import type { Context as GrammyContext } from "grammy";
import type { Restaurant, RestaurantUser } from "../types/database.js";

export interface SessionFlavor {
  restaurant: Restaurant;
  restaurantUser: RestaurantUser | null;
}

export type BotContext = GrammyContext & SessionFlavor;

export function isOwner(ctx: BotContext): boolean {
  return ctx.restaurantUser?.role === "owner";
}

export function isOwnerOrAdmin(ctx: BotContext): boolean {
  return ctx.restaurantUser?.role === "owner" || ctx.restaurantUser?.role === "admin";
}
