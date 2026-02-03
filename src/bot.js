import { Bot, InlineKeyboard, InputFile, Keyboard } from "grammy";
import puppeteer from "puppeteer";
import { readFileSync, unlinkSync, existsSync } from "fs";
import "dotenv/config";

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

const bot = new Bot(BOT_TOKEN);
const userChoices = new Map();
const lastMessageId = new Map();

const jadvalLinks = JSON.parse(
  readFileSync(new URL("./data.json", import.meta.url), "utf-8")
);

let browserInstance = null;

const getBrowser = async () => {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserInstance;
};

const getJadvalScreenshot = async (url) => {
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2,
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await page.evaluate(() => {
      const overlay = document.querySelector(".cc-window");
      if (overlay) overlay.remove();
      const topNav = document.querySelector(".headerDiv");
      if (topNav) topNav.remove();
      const menu = document.querySelector(".menuDiv");
      if (menu) menu.remove();
      const buttons = document.querySelectorAll("button");
      buttons.forEach((btn) => {
        if (
          btn.textContent.includes("OK") ||
          btn.textContent.includes("Accept")
        ) {
          btn.click();
        }
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const element = await page.$("table.mainclass");
    if (!element) {
      const screenshotPath = `jadval_${Date.now()}.jpg`;
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        type: "jpeg",
        quality: 100,
      });
      await page.close();
      return screenshotPath;
    }

    const screenshotPath = `jadval_${Date.now()}.jpg`;
    await element.screenshot({
      path: screenshotPath,
      type: "jpeg",
      quality: 100,
    });
    await page.close();
    return screenshotPath;
  } catch (error) {
    console.error("Screenshot error:", error.message);
    if (page) await page.close().catch(() => {});
    return null;
  }
};

bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard();
  Object.keys(jadvalLinks).forEach((fak) => {
    keyboard.text(fak, `fak_${fak}`).row();
  });

  const menuKeyboard = new Keyboard().text("Меню").resized();

  await ctx.reply("📚 Fakultetni tanlang:", {
    reply_markup: keyboard,
  });

  if (!userChoices.has(ctx.from.id)) {
    userChoices.set(ctx.from.id, {
      name: ctx.from.first_name + (ctx.from.last_name || ""),
    });
  }
});

bot.hears("Меню", async (ctx) => {
  const keyboard = new InlineKeyboard();
  Object.keys(jadvalLinks).forEach((fak) => {
    keyboard.text(fak, `fak_${fak}`).row();
  });

  await ctx.reply("📚 Fakultetni tanlang:", { reply_markup: keyboard });
});

bot.callbackQuery(/^fak_/, async (ctx) => {
  const fak = ctx.callbackQuery.data.replace("fak_", "");
  const keyboard = new InlineKeyboard();

  Object.keys(jadvalLinks[fak]).forEach((kurs) => {
    keyboard.text(kurs, `kurs_${fak}_${kurs}`).row();
  });

  await ctx.answerCallbackQuery().catch(() => {});
  await ctx.editMessageText(`🏛 ${fak}\n📘 Kursni tanlang:`, {
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^kurs_/, async (ctx) => {
  const parts = ctx.callbackQuery.data.split("_");
  const fak = parts[1];
  const kurs = parts.slice(2).join("_");
  const keyboard = new InlineKeyboard();

  Object.keys(jadvalLinks[fak][kurs]).forEach((guruh) => {
    keyboard.text(guruh, `group_${fak}_${kurs}_${guruh}`).row();
  });

  await ctx.answerCallbackQuery().catch(() => {});
  await ctx.editMessageText(`🏛 ${fak}\n📘 ${kurs}\n\n👥 Guruhni tanlang:`, {
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^group_/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});

  const parts = ctx.callbackQuery.data.split("_");
  const fak = parts[1];
  const kurs = parts[2];
  const guruh = parts.slice(3).join("_");

  userChoices.set(ctx.from.id, { fak, kurs, guruh, name: ctx.from.first_name });

  try {
    await ctx.deleteMessage();
  } catch (e) {}

  const link = jadvalLinks[fak][kurs][guruh];
  const screenshotPath = await getJadvalScreenshot(link);

  if (screenshotPath) {
    const keyboard = new InlineKeyboard()
      .text("🔄 Yangilash", "update_jadval")
      .row()
      .text("⬅️ Orqaga", "start_over");

    if (lastMessageId.has(ctx.from.id)) {
      try {
        await ctx.api.deleteMessage(
          ctx.chat.id,
          lastMessageId.get(ctx.from.id)
        );
      } catch (e) {}
    }

    const currentTime = new Date().toLocaleString("uz-UZ", {
      timeZone: "Asia/Tashkent",
    });
    const msg = await ctx.replyWithPhoto(new InputFile(screenshotPath), {
      caption: `🧾 *${fak} – ${kurs} – ${guruh}*\n\n📌 Bu jadval avtomatik Telegram bot orqali yuborildi.\n💡 Siz har doim /start buyrug'i orqali boshqa fakultet va guruhlarni tanlashingiz mumkin.\n🕒 Yangilangan sana: ${currentTime}\n📌 @tsuetimebot\nxatolik xaqida xabar bering - @ksh247`,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    lastMessageId.set(ctx.from.id, msg.message_id);

    if (existsSync(screenshotPath)) {
      unlinkSync(screenshotPath);
    }
  } else {
    await ctx.reply("⚠️ Jadvalni olishda xatolik yuz berdi.");
  }
});

bot.callbackQuery("update_jadval", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});

  const userId = ctx.from.id;
  const choice = userChoices.get(userId);

  if (choice && choice.fak && choice.kurs && choice.guruh) {
    if (lastMessageId.has(userId)) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, lastMessageId.get(userId));
      } catch (e) {}
    }

    const { fak, kurs, guruh } = choice;
    const link = jadvalLinks[fak][kurs][guruh];
    const screenshotPath = await getJadvalScreenshot(link);

    if (screenshotPath) {
      const currentTime = new Date().toLocaleString("uz-UZ", {
        timeZone: "Asia/Tashkent",
      });

      const keyboard = new InlineKeyboard()
        .text("🔄 Yangilash", "update_jadval")
        .row()
        .text("⬅️ Orqaga", "start_over");

      const msg = await ctx.replyWithPhoto(new InputFile(screenshotPath), {
        caption: `🔄 *Yangilangan jadval:*\n🧾 ${fak} – ${kurs} – ${guruh}\n🕒 ${currentTime}\nxatolik xaqida xabar bering - @ksh247\n📌 @tsuetimebot`,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      lastMessageId.set(userId, msg.message_id);

      if (existsSync(screenshotPath)) {
        unlinkSync(screenshotPath);
      }
    }
  } else {
    await ctx.reply(
      "⚠️ Siz hali guruh tanlamagansiz. /start buyrug'ini bosing."
    );
  }
});

bot.callbackQuery("start_over", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});

  const keyboard = new InlineKeyboard();
  Object.keys(jadvalLinks).forEach((fak) => {
    keyboard.text(fak, `fak_${fak}`).row();
  });

  if (lastMessageId.has(ctx.from.id)) {
    try {
      await ctx.api.deleteMessage(ctx.chat.id, lastMessageId.get(ctx.from.id));
    } catch (e) {}
  }

  await ctx.reply("📚 Fakultetni tanlang:", {
    reply_markup: keyboard,
  });
});

bot.command("status", async (ctx) => {
  const totalUsers = userChoices.size;
  const currentTime = new Date().toLocaleString("uz-UZ", {
    timeZone: "Asia/Tashkent",
  });

  await ctx.reply(
    `🤖 Bot holati:\n✅ Faol\n👥 Botni ishlatgan foydalanuvchilar soni: ${totalUsers}\n🕒 Holat yangilangan: ${currentTime}`
  );
});

bot.command("sent1", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    await ctx.reply("⚠️ Sizda bu buyruqni ishlatish huquqi yo'q.");
    return;
  }

  const text = ctx.message.text.split(" ").slice(1).join(" ");

  if (!text.trim()) {
    await ctx.reply(
      "✍️ Foydalanish: /sent1 [xabar matni]\nMasalan: /sent1 Jadval yangilandi ✅"
    );
    return;
  }

  if (userChoices.size === 0) {
    await ctx.reply(
      "⚠️ Hali hech kim botdan foydalanmagan yoki ro'yxat bo'sh."
    );
    return;
  }

  await ctx.reply("📢 Xabar yuborilmoqda...");

  let sent = 0;
  let failed = 0;

  for (const userId of userChoices.keys()) {
    try {
      await ctx.api.sendMessage(userId, text);
      sent++;
    } catch (e) {
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  await ctx.reply(
    `✅ Xabar ${sent} foydalanuvchiga yuborildi.\n❌ ${failed} foydalanuvchiga yuborilmadi.`
  );
});

bot.catch((err) => {
  console.error("Bot error:", err.message);
});

bot.start({
  onStart: () => console.log("Bot started successfully"),
});

process.once("SIGINT", async () => {
  if (browserInstance) await browserInstance.close();
  process.exit(0);
});
process.once("SIGTERM", async () => {
  if (browserInstance) await browserInstance.close();
  process.exit(0);
});
