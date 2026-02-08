import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { Bot, Context, InputFile } from "grammy";
import { ConfigService } from "@nestjs/config";
import { UserService } from "./services/user.service";
import { KeyboardService } from "./services/keyboard.service";
import { TranslationService, Language } from "./services/translation.service";
import { LoggerService } from "../common/services/logger.service";
import { ScreenshotService } from "../screenshot/screenshot.service";
import { AdminService } from "../admin/admin.service";

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
export class BotService implements OnModuleInit, OnModuleDestroy {
  private bot: Bot<BotContext>;
  private readonly logger = new Logger(BotService.name);
  private sessions: Map<number, SessionData> = new Map();
  private isRunning = false;

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private keyboardService: KeyboardService,
    private translationService: TranslationService,
    private loggerService: LoggerService,
    private screenshotService: ScreenshotService,
    private adminService: AdminService,
  ) { }

  private sanitizeCacheKey(key: string): string {
    return key.replace(/[\/\\]/g, "-");
  }

  async onModuleInit() {
    // this.logger.log("🤖 Bot initialization started");

    const token = this.configService.get<string>("BOT_TOKEN");

    if (!token) {
      this.logger.error("❌ BOT_TOKEN is not configured!");
      throw new Error("BOT_TOKEN environment variable is required");
    }

    this.bot = new Bot<BotContext>(token);

    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: true });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      if (
        !errorMessage.includes("404") &&
        !errorMessage.includes("Not Found")
      ) {
        // this.logger.warn("⚠️ Webhook deletion warning:", errorMessage);
      }
    }

    try {
      const me = await this.bot.api.getMe();
      // this.logger.log(`✅ Bot authenticated: @${me.username} (ID: ${me.id})`);
    } catch (error) {
      this.logger.error("❌ Bot authentication failed!");
      this.logger.error(`Error: ${error.message}`);

      if (error.error_code === 409) {
        this.logger.error(
          "⚠ CONFLICT ERROR - Another bot instance is running!",
        );
        throw new Error(
          "Conflict: Another bot instance is running. Stop it before starting a new one.",
        );
      }
      throw error;
    }

    this.setupCommands();
    this.setupCallbacks();
    this.setupErrorHandler();

    const defaultCommands = [
      { command: "start", description: "Botni ishga tushirish" },
      { command: "menu", description: "Asosiy menyu" },
      { command: "language", description: "Tilni o'zgartirish" },
      { command: "status", description: "Bot holati" },
    ];

    try {
      await this.bot.api.setMyCommands(defaultCommands);
    } catch (error) {
      this.logger.error("❌ Failed to set commands:", error.message);
    }

    try {
      this.isRunning = true;
      this.bot.start({
        onStart: (botInfo) => {
          // this.logger.log(`✅ BOT STARTED: @${botInfo.username}`);
        },
      });
    } catch (error) {
      this.isRunning = false;
      this.logger.error("❌ FAILED TO START BOT!");

      if (error.error_code === 409) {
        this.logger.error("⚠ Conflict: Another bot instance is running");
      } else {
        this.logger.error(`Error: ${error.message}`);
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.bot && this.isRunning) {
      try {
        await this.bot.stop();
        this.isRunning = false;
        // this.logger.log("Bot stopped");
      } catch (error) {
        this.logger.error("Error stopping bot:", error.message);
      }
    }
  }

  private setupErrorHandler() {
    this.bot.catch((err) => {
      const ctx = err.ctx;
      const e = err.error as any;

      if (e.error_code === 403) {
        // User blocked bot - don't log
        return;
      }

      if (
        e.error_code === 400 &&
        e.description?.includes("message is not modified")
      ) {
        return;
      }

      this.logger.error(`Grammy error in ${e.method}: ${e.description}`);
    });
  }

  private handleBotError(error: any, ctx: any, operation: string) {
    if (error.error_code === 403) {
      return;
    }

    if (
      error.error_code === 400 &&
      error.description?.includes("message is not modified")
    ) {
      return;
    }

    this.logger.error(`Error during ${operation}: ${error.message}`);
    throw error;
  }

  private setupCommands() {
    this.bot.command("start", async (ctx) => {
      try {
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
      } catch (error) {
        this.logger.error(`❌ Error in /start: ${error.message}`);
        this.handleBotError(error, ctx, "start command");
      }
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
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);

      if (!isAdmin) {
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

    this.bot.command("addadmin", async (ctx) => {
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);

      if (!isAdmin) {
        await ctx.reply("❌ Access denied");
        return;
      }

      // Check if replying to another user's message
      if (ctx.message.reply_to_message) {
        const targetUser = ctx.message.reply_to_message.from;
        const success = await this.adminService.addAdmin(
          targetUser.id,
          targetUser.username || targetUser.first_name,
        );

        if (success) {
          await ctx.reply(
            `✅ Admin qo'shildi:\n` +
            `ID: ${targetUser.id}\n` +
            `Username: @${targetUser.username || targetUser.first_name}`,
          );
        } else {
          await ctx.reply("❌ Admin qo'shishda xatolik yoki allaqachon admin");
        }
        return;
      }

      // Or use command with user ID
      const args = ctx.message.text.split(" ");
      if (args.length < 2) {
        await ctx.reply(
          "❌ Foydalanish:\n" +
          "1. Foydalanuvchi xabariga reply qiling va /addadmin buyrug'ini yuboring\n" +
          "2. Yoki: /addadmin <telegram_id> <username>",
        );
        return;
      }

      const telegramId = parseInt(args[1]);
      const username = args[2] || "unknown";

      if (isNaN(telegramId)) {
        await ctx.reply("❌ Noto'g'ri Telegram ID");
        return;
      }

      const success = await this.adminService.addAdmin(telegramId, username);
      if (success) {
        await ctx.reply(
          `✅ Admin qo'shildi:\n` +
          `ID: ${telegramId}\n` +
          `Username: ${username}`,
        );
      } else {
        await ctx.reply("❌ Admin qo'shishda xatolik yoki allaqachon admin");
      }
    });

    this.bot.command("removeadmin", async (ctx) => {
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);

      if (!isAdmin) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const args = ctx.message.text.split(" ");
      if (args.length < 2) {
        await ctx.reply("❌ Foydalanish: /removeadmin <telegram_id>");
        return;
      }

      const telegramId = parseInt(args[1]);
      if (isNaN(telegramId)) {
        await ctx.reply("❌ Noto'g'ri Telegram ID");
        return;
      }

      // Prevent removing yourself
      if (telegramId === ctx.from.id) {
        await ctx.reply("❌ O'zingizni admin ro'yxatidan o'chira olmaysiz");
        return;
      }

      const success = await this.adminService.removeAdmin(telegramId);
      if (success) {
        await ctx.reply(`✅ Admin o'chirildi: ${telegramId}`);
      } else {
        await ctx.reply("❌ Admin topilmadi yoki xatolik yuz berdi");
      }
    });

    this.bot.command("listadmins", async (ctx) => {
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);

      if (!isAdmin) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const admins = await this.adminService.listAdmins();
      if (admins.length === 0) {
        await ctx.reply("📭 Adminlar ro'yxati bo'sh");
        return;
      }

      let message = `👨‍💼 Adminlar ro'yxati (${admins.length}):\n\n`;
      admins.forEach((admin, index) => {
        message += `${index + 1}. @${admin.username}\n`;
        message += `   ID: ${admin.telegramId}\n\n`;
      });

      await ctx.reply(message);
    });

    this.bot.command("broadcast", async (ctx) => {
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);

      if (!isAdmin) {
        return;
      }

      const message = ctx.message.text.replace("/broadcast", "").trim();
      if (!message) {
        await ctx.reply(
          "❌ Please provide a message.\n\nUsage: /broadcast <your message>",
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
        }
      }

      await ctx.reply(
        `✅ Broadcast complete!\n\n` +
        `✓ Sent: ${successCount}\n` +
        `✗ Failed: ${failCount}\n` +
        `📊 Total: ${users.length}`,
      );
    });

    this.bot.command("status", async (ctx) => {
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";
      const stats = await this.userService.getUserStats();

      const message =
        `📊 Bot Status\n\n` +
        `👥 Total users: ${stats.total}\n` +
        `📅 Active today: ${stats.today}\n` +
        `📈 Active this week: ${stats.thisWeek}`;

      await ctx.reply(message);
    });

    this.bot.command("send", async (ctx) => {
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);

      if (!isAdmin) {
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
        `✅ Broadcast completed:\n\nSent: ${successCount}\nFailed: ${failCount}`,
      );
    });
  }

  private setupCallbacks() {
    // ...existing code...
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
        },
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
            lang,
          ),
        });
      },
    );

    this.bot.callbackQuery(/^cat:(teachers|kabinets)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      try {
        await ctx.editMessageText(
          this.translationService.t("underDevelopment", lang),
          {
            reply_markup: this.keyboardService.getCategoryKeyboard(lang),
          },
        );
      } catch (error) {
        if (!error.message?.includes("message is not modified")) {
          this.logger.error("Error editing message", error);
        }
      }
    });

    this.bot.callbackQuery(/^fak:([^:]+):(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const category = ctx.match[1];
      const fakultetId = ctx.match[2];
      const fakultet = this.keyboardService.decodeFacultyId(fakultetId);
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
            lang,
          ),
        },
      );
    });

    this.bot.callbackQuery(
      /^kurs:(kechki|masofaviy|magistr):(.+)$/,
      async (ctx) => {
        await ctx.answerCallbackQuery();
        const category = ctx.match[1];
        const kursId = ctx.match[2];
        const kurs = this.keyboardService.decodeCourse(kursId);
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
              lang,
            ),
          },
        );
      },
    );

    this.bot.callbackQuery(/^kurs:([^:]+):([^:]+):(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const category = ctx.match[1];
      const fakultetId = ctx.match[2];
      const kursId = ctx.match[3];
      const fakultet = this.keyboardService.decodeFacultyId(fakultetId);
      const kurs = this.keyboardService.decodeCourse(kursId);
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
            lang,
          ),
        },
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
        },
      );
    });

    this.bot.callbackQuery(
      /^guruh:([^:]+):([^:]+):([^:]+):(.+)$/,
      async (ctx) => {
        await ctx.answerCallbackQuery();
        const category = ctx.match[1];
        const fakultetId = ctx.match[2];
        const kursId = ctx.match[3];
        const guruh = ctx.match[4];

        const fakultet = this.keyboardService.decodeFacultyId(fakultetId);
        const kurs = this.keyboardService.decodeCourse(kursId);

        const user = await this.userService.findByTelegramId(ctx.from.id);
        const lang = (user?.language as Language) || "uz";

        await ctx.editMessageText(this.translationService.t("loading", lang));

        try {
          const url = this.keyboardService.getUrlForGroup(
            category,
            fakultetId !== "none" ? fakultetId : null,
            kursId,
            guruh,
          );

          if (!url) {
            await ctx.editMessageText(
              this.translationService.t("noSchedule", lang),
              {
                reply_markup: this.keyboardService.getCategoryKeyboard(lang),
              },
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
            guruh,
          );

          const cacheKey = this.sanitizeCacheKey(
            `${category}_${kurs}_${guruh}`,
          );

          const result = await this.screenshotService.getScreenshot(
            url,
            cacheKey,
          );

          try {
            await ctx.deleteMessage();
          } catch (error) {
            // Ignore
          }

          await ctx.replyWithPhoto(new InputFile(result.filePath), {
            caption: this.formatCaption(fakultet, kurs, guruh, false),
            reply_markup: this.keyboardService.getScheduleActionsKeyboard(
              category,
              fakultet,
              kurs,
              guruh,
              lang,
            ),
          });

          // Delete file after sending
          await this.screenshotService.deleteLocalFile(result.filePath);

          await this.loggerService.log(user.id, "view_schedule", {
            category,
            fakultet,
            kurs,
            guruh,
          });

          this.sessions.delete(ctx.from.id);
        } catch (error) {
          this.logger.error(`Error getting screenshot: ${error.message}`);

          let errorMessage = this.translationService.t("error", lang);

          if (
            error.message?.includes("Navigation timeout") ||
            error.message?.includes("timeout")
          ) {
            errorMessage =
              lang === "uz"
                ? "⚠️ Server sekin javob berayapti. Iltimos, bir oz kutib qayta urinib ko'ring."
                : lang === "ru"
                  ? "⚠️ Сервер медленно отвечает. Пожалуйста, подождите немного и попробуйте снова."
                  : "⚠️ Server is responding slowly. Please wait a moment and try again.";
          } else if (
            error.message?.includes("Chrome") ||
            error.message?.includes("Chromium") ||
            error.message?.includes("Browser not initialized")
          ) {
            errorMessage =
              lang === "uz"
                ? "❌ Server muammosi. Iltimos, administratorga xabar bering."
                : lang === "ru"
                  ? "❌ Проблема сервера. Пожалуйста, сообщите администратору."
                  : "❌ Server issue. Please notify the administrator.";
          }

          try {
            await ctx.editMessageText(errorMessage, {
              reply_markup: this.keyboardService.getCategoryKeyboard(lang),
            });
          } catch (editError) {
            // If edit fails, try sending new message
            try {
              await ctx.reply(errorMessage, {
                reply_markup: this.keyboardService.getCategoryKeyboard(lang),
              });
            } catch (replyError) {
              // Ignore
            }
          }
        }
      },
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
            null,
          );

          if (!url) {
            await ctx.editMessageText(
              this.translationService.t("noSchedule", lang),
              {
                reply_markup: this.keyboardService.getCategoryKeyboard(lang),
              },
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

          const cacheKey = this.sanitizeCacheKey(
            `${category}_${group}_${item.replace(/\s+/g, "_")}`,
          );

          const result = await this.screenshotService.getScreenshot(
            url,
            cacheKey,
          );

          await ctx.deleteMessage();
          const caption = category === "teachers" ? `👨‍🏫 ${item}` : `🚪 ${item}`;

          await ctx.replyWithPhoto(new InputFile(result.filePath), {
            caption,
            reply_markup: this.keyboardService.getScheduleActionsKeyboard(
              category,
              group,
              item,
              null,
              lang,
            ),
          });

          // Delete file after sending
          await this.screenshotService.deleteLocalFile(result.filePath);

          await this.loggerService.log(user.id, "view_schedule", {
            category,
            group,
            item,
          });

          this.sessions.delete(ctx.from.id);
        } catch (error) {
          this.logger.error(`Error getting screenshot: ${error.message}`);

          let errorMessage = this.translationService.t("error", lang);

          if (
            error.message?.includes("Navigation timeout") ||
            error.message?.includes("timeout")
          ) {
            errorMessage =
              lang === "uz"
                ? "⚠️ Server sekin javob berayapti. Iltimos, bir oz kutib qayta urinib ko'ring."
                : lang === "ru"
                  ? "⚠️ Сервер медленно отвечает. Пожалуйста, подождите немного и попробуйте снова."
                  : "⚠️ Server is responding slowly. Please wait a moment and try again.";
          } else if (
            error.message?.includes("Chrome") ||
            error.message?.includes("Chromium") ||
            error.message?.includes("Browser not initialized")
          ) {
            errorMessage =
              lang === "uz"
                ? "❌ Server muammosi. Iltimos, administratorga xabar bering."
                : lang === "ru"
                  ? "❌ Проблема сервера. Пожалуйста, сообщите администратору."
                  : "❌ Server issue. Please notify the administrator.";
          }

          try {
            await ctx.editMessageText(errorMessage, {
              reply_markup: this.keyboardService.getCategoryKeyboard(lang),
            });
          } catch (editError) {
            try {
              await ctx.reply(errorMessage, {
                reply_markup: this.keyboardService.getCategoryKeyboard(lang),
              });
            } catch (replyError) {
              // Ignore
            }
          }
        }
      },
    );

    this.bot.callbackQuery(
      /^refresh:([^:]+):([^:]+):([^:]+):(.+)$/,
      async (ctx) => {
        const category = ctx.match[1];
        const fakultetId = ctx.match[2];
        const kursId = ctx.match[3];
        const guruh = ctx.match[4];

        const fakultet = this.keyboardService.decodeFacultyId(fakultetId);
        const kurs = this.keyboardService.decodeCourse(kursId);

        const user = await this.userService.findByTelegramId(ctx.from.id);
        const lang = (user?.language as Language) || "uz";

        try {
          await ctx.answerCallbackQuery();
        } catch (error) {
          // Ignore
        }

        try {
          await ctx.editMessageCaption({
            caption: this.translationService.t("loading", lang),
          });
        } catch (error) {
          // Ignore
        }

        try {
          const url = this.keyboardService.getUrlForGroup(
            category,
            fakultetId !== "none" ? fakultetId : null,
            kursId,
            guruh,
          );

          if (!url) {
            await ctx.editMessageCaption({
              caption: this.translationService.t("noSchedule", lang),
              reply_markup: this.keyboardService.getScheduleActionsKeyboard(
                category,
                fakultet,
                kurs,
                guruh,
                lang,
              ),
            });
            return;
          }

          const cacheKey = this.sanitizeCacheKey(
            `${category}_${kurs}_${guruh}`,
          );

          const result = await this.screenshotService.getScreenshot(
            url,
            cacheKey,
          );

          try {
            await ctx.deleteMessage();
          } catch (error) {
            // Ignore
          }

          await ctx.replyWithPhoto(new InputFile(result.filePath), {
            caption: this.formatCaption(fakultet, kurs, guruh, true),
            reply_markup: this.keyboardService.getScheduleActionsKeyboard(
              category,
              fakultet,
              kurs,
              guruh,
              lang,
            ),
          });

          // Delete file after sending
          await this.screenshotService.deleteLocalFile(result.filePath);

          await this.loggerService.log(user.id, "refresh_schedule", {
            category,
            fakultet,
            kurs,
            guruh,
          });
        } catch (error) {
          this.logger.error(`Error refreshing screenshot: ${error.message}`);

          let errorMessage = this.translationService.t("error", lang);

          if (
            error.message?.includes("Navigation timeout") ||
            error.message?.includes("timeout")
          ) {
            errorMessage =
              lang === "uz"
                ? "⚠️ Server sekin javob berayapti. Iltimos, bir oz kutib qayta urinib ko'ring."
                : lang === "ru"
                  ? "⚠️ Сервер медленно отвечает. Пожалуйста, подождите немного и попробуйте снова."
                  : "⚠️ Server is responding slowly. Please wait a moment and try again.";
          } else if (
            error.message?.includes("Chrome") ||
            error.message?.includes("Chromium") ||
            error.message?.includes("Browser not initialized")
          ) {
            errorMessage =
              lang === "uz"
                ? "❌ Server muammosi. Iltimos, administratorga xabar bering."
                : lang === "ru"
                  ? "❌ Проблема сервера. Пожалуйста, сообщите администратору."
                  : "❌ Server issue. Please notify the administrator.";
          }

          try {
            await ctx.editMessageCaption({
              caption: errorMessage,
              reply_markup: this.keyboardService.getScheduleActionsKeyboard(
                category,
                fakultet,
                kurs,
                guruh,
                lang,
              ),
            });
          } catch (editError) {
            try {
              await ctx.deleteMessage();
              await ctx.reply(errorMessage, {
                reply_markup: this.keyboardService.getCategoryKeyboard(lang),
              });
            } catch (replyError) {
              // Ignore
            }
          }
        }
      },
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
        // Ignore
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
            lang,
          ),
        },
      );
    });

    this.bot.callbackQuery(/^back:kurs:([^:]+):(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const category = ctx.match[1];
      const fakultetId = ctx.match[2];
      const fakultet = this.keyboardService.decodeFacultyId(fakultetId);
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await ctx.editMessageText(
        this.translationService.t("selectCourse", lang),
        {
          reply_markup: this.keyboardService.getKursKeyboard(
            category,
            fakultet,
            lang,
          ),
        },
      );
    });

    this.bot.callbackQuery(/^admin:stats$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const stats = await this.userService.getUserStats();

      const message =
        `📊 Statistics\n\n` +
        `👥 Total users: ${stats.total}\n` +
        `📅 Active today: ${stats.today}\n` +
        `📈 Active this week: ${stats.thisWeek}`;

      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await this.safeEditMessageText(ctx, message, {
        reply_markup: this.keyboardService.getAdminKeyboard(lang),
      });
    });

    this.bot.callbackQuery(/^admin:users$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);
      if (!isAdmin) {
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

      await this.safeEditMessageText(ctx, message, {
        reply_markup: this.keyboardService.getAdminKeyboard(lang),
      });
    });

    this.bot.callbackQuery(/^admin:logs$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);
      if (!isAdmin) {
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
          const time = log.timestamp.toLocaleString();
          return `${time} - ${userName}: ${log.action}`;
        })
        .join("\n");

      const message = `📝 Recent Logs:\n\n${logList}`;

      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await this.safeEditMessageText(ctx, message, {
        reply_markup: this.keyboardService.getAdminKeyboard(lang),
      });
    });

    this.bot.callbackQuery(/^admin:admins$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);
      if (!isAdmin) {
        await ctx.reply("❌ Access denied");
        return;
      }

      const admins = await this.adminService.listAdmins();
      const adminList = admins
        .map((admin, i) => {
          return `${i + 1}. @${admin.username}\n   ID: ${admin.telegramId}`;
        })
        .join("\n\n");

      const message =
        `👨‍💼 Adminlar ro'yxati (${admins.length}):\n\n${adminList}\n\n` +
        `ℹ️ Admin qo'shish: /addadmin buyrug'ini foydalanuvchi xabariga reply qiling\n` +
        `ℹ️ Admin o'chirish: /removeadmin <telegram_id>`;

      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      await this.safeEditMessageText(ctx, message, {
        reply_markup: this.keyboardService.getAdminKeyboard(lang),
      });
    });

    this.bot.callbackQuery(/^admin:broadcast$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);
      if (!isAdmin) {
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

      await this.safeEditMessageText(ctx, message, {
        reply_markup: this.keyboardService.getAdminKeyboard(lang),
      });
    });

    this.bot.callbackQuery(/^back:admin$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const isAdmin = await this.adminService.isAdmin(ctx.from.id);
      if (!isAdmin) {
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

      await this.safeEditMessageText(ctx, message, {
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

  private async safeEditMessageText(
    ctx: any,
    text: string,
    options?: any,
  ): Promise<void> {
    try {
      await ctx.editMessageText(text, options);
    } catch (error) {
      if (
        error.message?.includes("message is not modified") ||
        (error.error_code === 400 &&
          error.description?.includes("message is not modified"))
      ) {
        return;
      }
      throw error;
    }
  }

  private formatCaption(
    fakultet: string | null,
    kurs: string,
    guruh: string,
    isRefresh: boolean = false,
  ): string {
    const now = new Date();
    const date = now.toLocaleDateString("en-GB");
    const time = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const fakultetName = fakultet && fakultet !== "none" ? fakultet : "";
    const icon = isRefresh ? "🔄 Yangilangan jadval:" : "📅";

    let caption = `${icon}\n🧾 ${fakultetName ? fakultetName + " – " : ""
      }${kurs} – ${guruh}\n`;
    caption += `🕒 ${date}, ${time}\n`;
    caption += `xatolik xaqida xabar bering - @ksh247\n`;
    caption += `📌 @tsuetimebot`;

    return caption;
  }

  getBot(): Bot<BotContext> {
    return this.bot;
  }

  async sendMessage(chatId: string, text: string) {
    try {
      await this.bot.api.sendMessage(chatId, text);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send message to ${chatId}: ${error.message}`,
      );
      return false;
    }
  }
}
