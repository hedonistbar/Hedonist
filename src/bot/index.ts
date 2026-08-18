import { Bot } from "grammy";
import { loadEnv } from "../config/env.js";
import { addAdminCommand, whoamiCommand } from "./commands/admin.js";
import { helpCommand } from "./commands/help.js";
import { pauseCommand, resumeCommand } from "./commands/pause.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import type { BotContext } from "./context.js";
import { tenantMiddleware } from "./middleware/tenant.js";

const env = loadEnv();
const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

bot.use(tenantMiddleware);

bot.command("start", startCommand);
bot.command("help", helpCommand);
bot.command("status", statusCommand);
bot.command("pause", pauseCommand);
bot.command("resume", resumeCommand);
bot.command("add_admin", addAdminCommand);
bot.command("whoami", whoamiCommand);

bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
});

bot.start({
  onStart: (botInfo) => {
    console.log(`Hedonist AI-marketer bot started as @${botInfo.username}`);
  },
});
