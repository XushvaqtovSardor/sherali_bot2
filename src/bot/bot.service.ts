import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Bot, Context, InputFile } from "grammy";
import { ConfigService } from "@nestjs/config";
import { UserService } from "./services/user.service";
import { KeyboardService } from "./services/keyboard.service";
import { TranslationService, Language } from "./services/translation.service";
import { LoggerService } from "../common/services/logger.service";
import { ScreenshotService } from "../screenshot/screenshot.service";

interface SessionData {
  step?: "language" | "category" | "fakultet" | "kurs" | "guruh";
  language?: Language;
  category?: string;
  fakultet?: string;
  kurs?: string;
  guruh?: string;
}

type BotContext = Context & {
  session?: SessionData;
};

@Injectable()
export class BotService implements OnModuleInit {
  private bot: Bot<BotContext>;
  private readonly logger = new Logger(BotService.name);
  private sessions: Map<number, SessionData> = new Map();

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private keyboardService: KeyboardService,
    private translationService: TranslationService,
    private loggerService: LoggerService,
    private screenshotService: ScreenshotService
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>("BOT_TOKEN");
    this.bot = new Bot<BotContext>(token);

    // Force delete webhook and wait to ensure no conflicts
    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: true });
      this.logger.log("Webhook deleted successfully");
      // Wait a bit to ensure Telegram processes the webhook deletion
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      this.logger.error("Failed to delete webhook:", error.message);
      throw error;
    }

    this.setupCommands();
    this.setupCallbacks();

    const defaultCommands = [
      { command: "start", description: "Start bot" },
      { command: "menu", description: "Main menu" },
      { command: "language", description: "Change language" },
      { command: "status", description: "Bot status" },
    ];
    await this.bot.api.setMyCommands(defaultCommands);

    const adminId = parseInt(this.configService.get<string>("ADMIN_ID"));
    if (adminId) {
      const adminCommands = [
        ...defaultCommands,
        { command: "admin", description: "Admin panel" },
      ];
      await this.bot.api.setMyCommands(adminCommands, {
        scope: { type: "chat", chat_id: adminId },
      });
    }

    try {
      this.bot.start();
      this.logger.log("Bot started successfully");
    } catch (error) {
      this.logger.error("Failed to start bot:", error.message);
      throw error;
    }
  }

  private setupCommands() {
    this.bot.command("start", async (ctx) => {
      const telegramId = ctx.from.id;
      const firstName = ctx.from.first_name;
      const lastName = ctx.from.last_name;
      const username = ctx.from.username;

      let user = await this.userService.findByTelegramId(telegramId);
      const isNewUser = !user;

      if (!user) {
        user = await this.userService.createOrUpdateUser({
          telegramId,
          firstName,
          lastName,
          username,
        });
      }

      if (isNewUser) {
        await ctx.reply(this.translationService.t("selectLanguage", "uz"), {
          reply_markup: this.translationService.getLanguageKeyboard(),
        });
      } else {
        const lang = user.language as Language;
        await ctx.reply(this.translationService.t("welcome", lang), {
          reply_markup: this.keyboardService.getCategoryKeyboard(lang),
        });
      }

      await this.loggerService.log(user.id, "start_command");
    });

    this.bot.command("menu", async (ctx) => {
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await ctx.reply(this.translationService.t("mainMenu", lang), {
        reply_markup: this.keyboardService.getCategoryKeyboard(lang),
      });
    });

    this.bot.command("language", async (ctx) => {
      await ctx.reply(this.translationService.t("selectLanguage", "uz"), {
        reply_markup: this.translationService.getLanguageKeyboard(),
      });
    });

    this.bot.command("admin", async (ctx) => {
      const adminId = parseInt(this.configService.get<string>("ADMIN_ID"));
      this.logger.log(`Admin check: user ${ctx.from.id} vs admin ${adminId}`);

      if (ctx.from.id !== adminId) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";
      const stats = await this.userService.getUserStats();

      const message =
        `👨‍💼 Admin Panel\n\n` +
        `📊 Statistics:\n` +
        `👥 Total users: ${stats.total}\n` +
        `📅 Active today: ${stats.today}\n` +
        `📈 Active this week: ${stats.thisWeek}`;

      await ctx.reply(message, {
        reply_markup: this.keyboardService.getAdminKeyboard(lang),
      });
    });

    this.bot.command("broadcast", async (ctx) => {
      const adminId = parseInt(this.configService.get<string>("ADMIN_ID"));
      if (ctx.from.id !== adminId) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const message = ctx.message.text.replace("/broadcast", "").trim();
      if (!message) {
        await ctx.reply(
          "❌ Please provide a message.\n\nUsage: /broadcast <your message>"
        );
        return;
      }

      const users = await this.userService.getAllUsers();
      let successCount = 0;
      let failCount = 0;

      await ctx.reply(`📤 Sending message to ${users.length} users...`);

      for (const user of users) {
        try {
          await this.bot.api.sendMessage(Number(user.telegramId), message);
          successCount++;

          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (error) {
          failCount++;
          this.logger.warn(
            `Failed to send message to user ${user.telegramId}:`,
            error.message
          );
        }
      }

      await ctx.reply(
        `✅ Broadcast complete!\n\n` +
          `✓ Sent: ${successCount}\n` +
          `✗ Failed: ${failCount}\n` +
          `📊 Total: ${users.length}`
      );
    });

    this.bot.command("status", async (ctx) => {
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";
      const stats = await this.userService.getUserStats();
      const allCached = await this.screenshotService.getAllCachedScreenshots();

      let lastUpdateInfo =
        lang === "ru" ? "Нет кэша" : lang === "en" ? "No cache" : "Kesh yo'q";
      if (allCached.length > 0) {
        const latestCache = allCached[0];
        const dateStr = latestCache.createdAt.toLocaleString(
          lang === "ru" ? "ru-RU" : lang === "en" ? "en-US" : "uz-UZ"
        );
        lastUpdateInfo =
          lang === "ru"
            ? `Последнее обновление: ${dateStr}`
            : lang === "en"
            ? `Last update: ${dateStr}`
            : `Oxirgi yangilanish: ${dateStr}`;
      }

      await ctx.reply(
        this.translationService.t("statusTitle", lang) +
          "\n\n" +
          this.translationService.t("statusBot", lang) +
          "\n" +
          this.translationService.t("statusDb", lang) +
          "\n" +
          this.translationService.t("statusCache", lang) +
          "\n\n" +
          lastUpdateInfo
      );
    });

    this.bot.command("send", async (ctx) => {
      const adminId = parseInt(this.configService.get<string>("ADMIN_ID"));
      if (ctx.from.id !== adminId) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const text = ctx.message.text.replace("/send", "").trim();
      if (!text) {
        await ctx.reply("Usage: /send <message>");
        return;
      }

      const users = await this.userService.getAllUsers();
      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          await this.bot.api.sendMessage(Number(user.telegramId), text);
          successCount++;
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (error) {
          failCount++;
        }
      }

      await ctx.reply(
        `✅ Broadcast completed:\n\nSent: ${successCount}\nFailed: ${failCount}`
      );
    });
  }

  private setupCallbacks() {
    this.bot.callbackQuery(/^lang_(ru|en|uz)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const lang = ctx.match[1] as Language;

      const user = await this.userService.findByTelegramId(ctx.from.id);
      await this.userService.updateUserLanguage(user.id, lang);

      await ctx.editMessageText(
        this.translationService.t("languageSelected", lang) +
          "\n\n" +
          this.translationService.t("welcome", lang),
        {
          reply_markup: this.keyboardService.getCategoryKeyboard(lang),
        }
      );
    });

    this.bot.callbackQuery(
      /^cat:(bakalavr|kechki|masofaviy|magistr)$/,
      async (ctx) => {
        await ctx.answerCallbackQuery();
        const category = ctx.match[1];
        const user = await this.userService.findByTelegramId(ctx.from.id);
        const lang = (user?.language as Language) || "uz";

        const session = this.getSession(ctx.from.id);
        session.category = category;
        session.step = category === "bakalavr" ? "fakultet" : "kurs";

        const message =
          category === "bakalavr"
            ? this.translationService.t("selectFaculty", lang)
            : this.translationService.t("selectCourse", lang);

        await ctx.editMessageText(message, {
          reply_markup: this.keyboardService.getFakultetKeyboard(
            category,
            lang
          ),
        });
      }
    );

    this.bot.callbackQuery(/^fak:([^:]+):(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const category = ctx.match[1];
      const fakultet = ctx.match[2];
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      const session = this.getSession(ctx.from.id);
      session.category = category;
      session.fakultet = fakultet;
      session.step = "kurs";

      await ctx.editMessageText(
        this.translationService.t("selectCourse", lang),
        {
          reply_markup: this.keyboardService.getKursKeyboard(
            category,
            fakultet,
            lang
          ),
        }
      );
    });

    this.bot.callbackQuery(
      /^kurs:(kechki|masofaviy|magistr):(.+)$/,
      async (ctx) => {
        await ctx.answerCallbackQuery();
        const category = ctx.match[1];
        const kurs = ctx.match[2];
        const user = await this.userService.findByTelegramId(ctx.from.id);
        const lang = (user?.language as Language) || "uz";

        const session = this.getSession(ctx.from.id);
        session.category = category;
        session.fakultet = null;
        session.kurs = kurs;
        session.step = "guruh";

        await ctx.editMessageText(
          this.translationService.t("selectGroup", lang),
          {
            reply_markup: this.keyboardService.getGuruhKeyboard(
              category,
              "none",
              kurs,
              lang
            ),
          }
        );
      }
    );

    this.bot.callbackQuery(/^kurs:([^:]+):([^:]+):(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const category = ctx.match[1];
      const fakultet = ctx.match[2];
      const kurs = ctx.match[3];
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      const session = this.getSession(ctx.from.id);
      session.category = category;
      session.fakultet = fakultet !== "none" ? fakultet : null;
      session.kurs = kurs;
      session.step = "guruh";

      await ctx.editMessageText(
        this.translationService.t("selectGroup", lang),
        {
          reply_markup: this.keyboardService.getGuruhKeyboard(
            category,
            fakultet,
            kurs,
            lang
          ),
        }
      );
    });

    this.bot.callbackQuery(/^kurs:(teachers|kabinets):(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const category = ctx.match[1];
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await ctx.editMessageText(
        this.translationService.t("underDevelopment", lang),
        {
          reply_markup: this.keyboardService.getCategoryKeyboard(lang),
        }
      );
    });

    this.bot.callbackQuery(
      /^guruh:([^:]+):([^:]+):([^:]+):(.+)$/,
      async (ctx) => {
        this.logger.log(`Guruh callback triggered: ${ctx.callbackQuery.data}`);
        await ctx.answerCallbackQuery();
        const category = ctx.match[1];
        const fakultet = ctx.match[2];
        const kurs = ctx.match[3];
        const guruh = ctx.match[4];

        this.logger.log(
          `Parsed: category=${category}, fakultet=${fakultet}, kurs=${kurs}, guruh=${guruh}`
        );

        const user = await this.userService.findByTelegramId(ctx.from.id);
        const lang = (user?.language as Language) || "uz";

        await ctx.editMessageText(this.translationService.t("loading", lang));

        try {
          const url = this.keyboardService.getUrlForGroup(
            category,
            fakultet !== "none" ? fakultet : null,
            kurs,
            guruh
          );

          if (!url) {
            await ctx.editMessageText(
              this.translationService.t("noSchedule", lang),
              {
                reply_markup: this.keyboardService.getCategoryKeyboard(lang),
              }
            );
            return;
          }

          await this.userService.updateUserChoice(user.id, {
            category,
            fakultet: fakultet !== "none" ? fakultet : null,
            kurs,
            guruh,
            url,
          });

          await this.userService.createChoice(
            user.id,
            fakultet !== "none" ? fakultet : category,
            kurs,
            guruh
          );

          const screenshotPath =
            await this.screenshotService.getOrCreateScreenshot(
              url,
              `${category}_${kurs}_${guruh}`
            );

          this.logger.log(`Screenshot URL: ${screenshotPath}`);

          try {
            await ctx.deleteMessage();
          } catch (error) {
            this.logger.warn("Could not delete message:", error.message);
          }

          await ctx.replyWithPhoto(screenshotPath, {
            caption: `📅 ${guruh} - ${kurs}`,
            reply_markup: this.keyboardService.getScheduleActionsKeyboard(
              category,
              fakultet,
              kurs,
              guruh,
              lang
            ),
          });

          this.logger.log(`Photo sent successfully for ${guruh}`);

          await this.loggerService.log(user.id, "view_schedule", {
            category,
            fakultet,
            kurs,
            guruh,
          });

          this.sessions.delete(ctx.from.id);
        } catch (error) {
          this.logger.error("Error getting screenshot", error);
          this.logger.error("Error stack:", error?.stack);
          this.logger.error("Error message:", error?.message);
          try {
            await ctx.editMessageText(
              this.translationService.t("error", lang),
              {
                reply_markup: this.keyboardService.getCategoryKeyboard(lang),
              }
            );
          } catch (editError) {
            this.logger.error("Failed to edit message", editError);
          }
        }
      }
    );

    this.bot.callbackQuery(
      /^guruh:(teachers|kabinets):(.+):(.+)$/,
      async (ctx) => {
        await ctx.answerCallbackQuery();
        const category = ctx.match[1];
        const group = ctx.match[2];
        const item = ctx.match[3];

        const user = await this.userService.findByTelegramId(ctx.from.id);
        const lang = (user?.language as Language) || "uz";

        await ctx.editMessageText(this.translationService.t("loading", lang));

        try {
          const url = this.keyboardService.getUrlForGroup(
            category,
            group,
            item,
            null
          );

          if (!url) {
            await ctx.editMessageText(
              this.translationService.t("noSchedule", lang),
              {
                reply_markup: this.keyboardService.getCategoryKeyboard(lang),
              }
            );
            return;
          }

          await this.userService.updateUserChoice(user.id, {
            category,
            fakultet: group,
            kurs: item,
            guruh: null,
            url,
          });

          await this.userService.createChoice(user.id, category, group, item);

          const screenshotPath =
            await this.screenshotService.getOrCreateScreenshot(
              url,
              `${category}_${group}_${item.replace(/\s+/g, "_")}`
            );

          await ctx.deleteMessage();
          const caption = category === "teachers" ? `👨‍🏫 ${item}` : `🚪 ${item}`;
          await ctx.replyWithPhoto(screenshotPath, {
            caption,
            reply_markup: this.keyboardService.getScheduleActionsKeyboard(
              category,
              group,
              item,
              null,
              lang
            ),
          });

          await this.loggerService.log(user.id, "view_schedule", {
            category,
            group,
            item,
          });

          this.sessions.delete(ctx.from.id);
        } catch (error) {
          this.logger.error("Error getting screenshot", error);
          await ctx.editMessageText(this.translationService.t("error", lang), {
            reply_markup: this.keyboardService.getCategoryKeyboard(lang),
          });
        }
      }
    );

    this.bot.callbackQuery(
      /^refresh:([^:]+):([^:]+):([^:]+):(.+)$/,
      async (ctx) => {
        const category = ctx.match[1];
        const fakultet = ctx.match[2];
        const kurs = ctx.match[3];
        const guruh = ctx.match[4];

        const user = await this.userService.findByTelegramId(ctx.from.id);
        const lang = (user?.language as Language) || "uz";

        // Answer callback query immediately to prevent timeout
        try {
          await ctx.answerCallbackQuery();
        } catch (error) {
          this.logger.warn("Could not answer callback query:", error.message);
        }

        // Edit message to show loading
        try {
          await ctx.editMessageCaption({
            caption: this.translationService.t("loading", lang),
          });
        } catch (error) {
          this.logger.warn("Could not edit caption:", error.message);
        }

        try {
          const url = this.keyboardService.getUrlForGroup(
            category,
            fakultet !== "none" ? fakultet : null,
            kurs,
            guruh
          );

          if (!url) {
            await ctx.editMessageCaption({
              caption: this.translationService.t("noSchedule", lang),
              reply_markup: this.keyboardService.getScheduleActionsKeyboard(
                category,
                fakultet,
                kurs,
                guruh,
                lang
              ),
            });
            return;
          }

          const screenshotPath =
            await this.screenshotService.getOrCreateScreenshot(
              url,
              `${category}_${kurs}_${guruh}`,
              true
            );

          try {
            await ctx.deleteMessage();
          } catch (error) {
            this.logger.warn("Could not delete message:", error.message);
          }

          await ctx.replyWithPhoto(screenshotPath, {
            caption: `📅 ${guruh} - ${kurs}`,
            reply_markup: this.keyboardService.getScheduleActionsKeyboard(
              category,
              fakultet,
              kurs,
              guruh,
              lang
            ),
          });

          await this.loggerService.log(user.id, "refresh_schedule", {
            category,
            fakultet,
            kurs,
            guruh,
          });
        } catch (error) {
          this.logger.error("Error refreshing screenshot", error);
          try {
            await ctx.editMessageCaption({
              caption: this.translationService.t("error", lang),
              reply_markup: this.keyboardService.getScheduleActionsKeyboard(
                category,
                fakultet,
                kurs,
                guruh,
                lang
              ),
            });
          } catch (editError) {
            this.logger.error("Failed to edit message caption", editError);
          }
        }
      }
    );

    this.bot.callbackQuery(/^back:main$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await ctx.editMessageText(this.translationService.t("mainMenu", lang), {
        reply_markup: this.keyboardService.getCategoryKeyboard(lang),
      });
    });

    this.bot.callbackQuery(/^back:category$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      try {
        await ctx.deleteMessage();
      } catch (error) {
        this.logger.warn("Could not delete message:", error.message);
      }

      await ctx.reply(this.translationService.t("mainMenu", lang), {
        reply_markup: this.keyboardService.getCategoryKeyboard(lang),
      });
    });

    this.bot.callbackQuery(/^back:fakultet:(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const category = ctx.match[1];
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await ctx.editMessageText(
        this.translationService.t("selectFaculty", lang),
        {
          reply_markup: this.keyboardService.getFakultetKeyboard(
            category,
            lang
          ),
        }
      );
    });

    this.bot.callbackQuery(/^back:kurs:([^:]+):(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const category = ctx.match[1];
      const fakultet = ctx.match[2];
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await ctx.editMessageText(
        this.translationService.t("selectCourse", lang),
        {
          reply_markup: this.keyboardService.getKursKeyboard(
            category,
            fakultet,
            lang
          ),
        }
      );
    });

    this.bot.callbackQuery(/^admin:stats$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const adminId = parseInt(this.configService.get<string>("ADMIN_ID"));
      if (ctx.from.id !== adminId) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const stats = await this.userService.getUserStats();
      const allCached = await this.screenshotService.getAllCachedScreenshots();

      const message =
        `📊 Statistics\n\n` +
        `👥 Total users: ${stats.total}\n` +
        `📅 Active today: ${stats.today}\n` +
        `📈 Active this week: ${stats.thisWeek}\n` +
        `🖼 Cached screenshots: ${allCached.length}`;

      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await ctx.editMessageText(message, {
        reply_markup: this.keyboardService.getAdminKeyboard(lang),
      });
    });

    this.bot.callbackQuery(/^admin:users$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const adminId = parseInt(this.configService.get<string>("ADMIN_ID"));
      if (ctx.from.id !== adminId) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const users = await this.userService.getAllUsers();
      const userList = users
        .slice(0, 50)
        .map((u, i) => {
          const name = u.firstName + (u.lastName ? " " + u.lastName : "");
          const username = u.username ? `@${u.username}` : "";
          return `${i + 1}. ${name} ${username} (ID: ${u.telegramId})`;
        })
        .join("\n");

      const message = `👥 Users (${users.length} total, showing first 50):\n\n${userList}`;

      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await ctx.editMessageText(message, {
        reply_markup: this.keyboardService.getAdminKeyboard(lang),
      });
    });

    this.bot.callbackQuery(/^admin:logs$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const adminId = parseInt(this.configService.get<string>("ADMIN_ID"));
      if (ctx.from.id !== adminId) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const logs = await this.loggerService.getRecentLogs(20);
      const logList = logs
        .map((log) => {
          const userName = log.user
            ? log.user.firstName +
              (log.user.lastName ? " " + log.user.lastName : "")
            : "Unknown";
          const timestamp = log.timestamp.toLocaleString();
          return `${timestamp} - ${userName}: ${log.action}`;
        })
        .join("\n");

      const message = `📋 Recent Logs (last 20):\n\n${logList}`;

      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await ctx.editMessageText(message, {
        reply_markup: this.keyboardService.getAdminKeyboard(lang),
      });
    });

    this.bot.callbackQuery(/^admin:broadcast$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const adminId = parseInt(this.configService.get<string>("ADMIN_ID"));
      if (ctx.from.id !== adminId) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const message =
        `📢 Broadcast Message\n\n` +
        `To send a message to all users, use:\n` +
        `/broadcast <your message>\n\n` +
        `Example:\n` +
        `/broadcast Hello everyone! Bot is updated.`;

      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await ctx.editMessageText(message, {
        reply_markup: this.keyboardService.getAdminKeyboard(lang),
      });
    });

    this.bot.callbackQuery(/^admin:clear_cache$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const adminId = parseInt(this.configService.get<string>("ADMIN_ID"));
      if (ctx.from.id !== adminId) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await ctx.editMessageText("🔄 Clearing cache...");

      try {
        const deletedCount = await this.screenshotService.clearAllCache();

        const message =
          `✅ Cache cleared successfully!\n\n` +
          `🗑 Deleted ${deletedCount} screenshots\n` +
          `💾 Database cleaned\n` +
          `🔴 Redis cleaned`;

        await ctx.editMessageText(message, {
          reply_markup: this.keyboardService.getAdminKeyboard(lang),
        });
      } catch (error) {
        this.logger.error("Error clearing cache", error);
        await ctx.editMessageText(
          "❌ Error clearing cache. Check logs for details.",
          {
            reply_markup: this.keyboardService.getAdminKeyboard(lang),
          }
        );
      }
    });

    this.bot.callbackQuery(/^back:admin$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const adminId = parseInt(this.configService.get<string>("ADMIN_ID"));
      if (ctx.from.id !== adminId) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";
      const stats = await this.userService.getUserStats();

      const message =
        `👨‍💼 Admin Panel\n\n` +
        `📊 Statistics:\n` +
        `👥 Total users: ${stats.total}\n` +
        `📅 Active today: ${stats.today}\n` +
        `📈 Active this week: ${stats.thisWeek}`;

      await ctx.editMessageText(message, {
        reply_markup: this.keyboardService.getAdminKeyboard(lang),
      });
    });
  }

  private getSession(userId: number): SessionData {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {});
    }
    return this.sessions.get(userId);
  }

  getBot(): Bot<BotContext> {
    return this.bot;
  }
}
