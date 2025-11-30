import { Bot } from "grammy";
import "dotenv/config";
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Bot(BOT_TOKEN);
bot.command("start", (ctx) => ctx.reply("Assalom alykumm"));
bot.on("message", (ctx) => ctx.reply("hi there"));

bot.start();
