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
    private screenshotService: ScreenshotService
  ) {}

  async onModuleInit() {
    this.logger.log("========================================");
    this.logger.log("🤖 Bot service initialization started");
    this.logger.log("========================================");

    const token = this.configService.get<string>("BOT_TOKEN");

    if (!token) {
      this.logger.error("❌ BOT_TOKEN is not configured!");
      throw new Error("BOT_TOKEN environment variable is required");
    }

    this.logger.log(`✓ BOT_TOKEN loaded: ${token.substring(0, 15)}...`);
    this.bot = new Bot<BotContext>(token);
    this.logger.log("✓ Bot instance created");

    // Force delete webhook and wait to ensure no conflicts
    try {
      this.logger.log("📡 Deleting any existing webhook...");
      await this.bot.api.deleteWebhook({ drop_pending_updates: true });
      this.logger.log("✓ Webhook deleted successfully");
      // Wait a bit to ensure Telegram processes the webhook deletion
      await new Promise((resolve) => setTimeout(resolve, 2000));
      this.logger.log("✓ Waited 2 seconds for webhook cleanup");
    } catch (error: any) {
      // 404 error is OK - means webhook doesn't exist (polling mode)
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
        this.logger.log(
          "ℹ️ No webhook to delete (404 - this is normal for polling mode)"
        );
      } else {
        this.logger.warn("⚠️ Webhook deletion warning:", errorMessage);
      }
      // Don't throw - webhook issues shouldn't stop bot startup
    }

    // Check if another instance is running by trying to get updates
    try {
      this.logger.log("🔍 Authenticating bot with Telegram...");
      const me = await this.bot.api.getMe();
      this.logger.log(`✓ Bot authenticated as: @${me.username} (ID: ${me.id})`);
      this.logger.log(`  - First name: ${me.first_name}`);
      this.logger.log(`  - Can join groups: ${me.can_join_groups}`);
      this.logger.log(
        `  - Can read all group messages: ${me.can_read_all_group_messages}`
      );
    } catch (error) {
      this.logger.error("❌ Bot authentication failed!");
      this.logger.error(`Error code: ${error.error_code}`);
      this.logger.error(`Error message: ${error.message}`);

      if (error.error_code === 409) {
        this.logger.error("========================================");
        this.logger.error("⚠ CONFLICT ERROR - 409");
        this.logger.error("Another bot instance is already running!");
        this.logger.error("========================================");
        this.logger.error("Possible causes:");
        this.logger.error("1. Another Docker container is running");
        this.logger.error("2. Another process is using this bot token");
        this.logger.error("3. Webhook was not properly deleted");
        this.logger.error("========================================");
        this.logger.error("Solutions:");
        this.logger.error("1. Run: docker ps -a");
        this.logger.error("2. Run: docker stop <container_id>");
        this.logger.error("3. Check if any node processes are running");
        this.logger.error("========================================");
        throw new Error(
          "Conflict: Another bot instance is running. Stop it before starting a new one."
        );
      }
      throw error;
    }

    this.logger.log("🔧 Setting up bot handlers...");
    this.setupCommands();
    this.logger.log("✓ Commands set up");

    this.setupCallbacks();
    this.logger.log("✓ Callbacks set up");

    this.setupErrorHandler();
    this.logger.log("✓ Error handler set up");

    // Set default commands for all users
    const defaultCommands = [
      { command: "start", description: "Botni ishga tushirish" },
      { command: "menu", description: "Asosiy menyu" },
      { command: "language", description: "Tilni o'zgartirish" },
      { command: "status", description: "Bot holati" },
    ];

    try {
      this.logger.log("📝 Setting bot commands...");
      await this.bot.api.setMyCommands(defaultCommands);
      this.logger.log("✓ Default commands set successfully");
    } catch (error) {
      this.logger.error("❌ Failed to set default commands:", error.message);
    }

    // Set admin commands for admin user
    const adminId = parseInt(this.configService.get<string>("ADMIN_ID"));
    this.logger.log(`👤 Admin ID from config: ${adminId}`);

    if (adminId && !isNaN(adminId)) {
      const adminCommands = [
        ...defaultCommands,
        { command: "admin", description: "Admin panel" },
      ];

      try {
        await this.bot.api.setMyCommands(adminCommands, {
          scope: { type: "chat", chat_id: adminId },
        });
        this.logger.log(`✓ Admin commands set for user: ${adminId}`);
      } catch (error) {
        this.logger.error(
          `❌ Failed to set admin commands for ${adminId}:`,
          error.message
        );
      }
    } else {
      this.logger.warn("⚠ Admin ID not configured or invalid");
    }

    try {
      this.logger.log("========================================");
      this.logger.log("🚀 Starting bot polling...");
      this.logger.log("========================================");

      this.isRunning = true;
      this.bot.start({
        onStart: (botInfo) => {
          this.logger.log("========================================");
          this.logger.log(`✅ BOT STARTED SUCCESSFULLY!`);
          this.logger.log(`✅ Username: @${botInfo.username}`);
          this.logger.log(`✅ Bot ID: ${botInfo.id}`);
          this.logger.log("✅ Bot is now listening for messages...");
          this.logger.log("========================================");
        },
      });
    } catch (error) {
      this.isRunning = false;
      this.logger.error("========================================");
      this.logger.error("❌ FAILED TO START BOT!");
      this.logger.error("========================================");

      if (error.error_code === 409) {
        this.logger.error("⚠ Conflict: Another bot instance is running");
      } else {
        this.logger.error(`Error: ${error.message}`);
        this.logger.error(`Stack: ${error.stack}`);
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log("Shutting down bot...");
    if (this.bot && this.isRunning) {
      try {
        await this.bot.stop();
        this.isRunning = false;
        this.logger.log("Bot stopped successfully");
      } catch (error) {
        this.logger.error("Error stopping bot:", error.message);
      }
    }
  }

  private setupErrorHandler() {
    this.bot.catch((err) => {
      const ctx = err.ctx;
      this.logger.error(`Error while handling update ${ctx.update.update_id}:`);
      const e = err.error as any;

      if (e.error_code === 403) {
        // User blocked the bot - log and ignore
        this.logger.warn(
          `Bot was blocked by user ${ctx.from?.id} (@${ctx.from?.username})`
        );
        return;
      }

      if (
        e.error_code === 400 &&
        e.description?.includes("message is not modified")
      ) {
        // Message not modified - already handled by safeEditMessageText
        return;
      }

      // Log other errors
      this.logger.error(`Grammy error in ${e.method}:`, e.description);
      this.logger.error("Error details:", e);
    });
  }

  private handleBotError(error: any, ctx: any, operation: string) {
    if (error.error_code === 403) {
      this.logger.warn(
        `User ${ctx.from?.id} (@${ctx.from?.username}) has blocked the bot during ${operation}`
      );
      return;
    }

    if (
      error.error_code === 400 &&
      error.description?.includes("message is not modified")
    ) {
      // Silently ignore
      return;
    }

    this.logger.error(`Error during ${operation}:`, error.message);
    throw error;
  }

  private setupCommands() {
    this.bot.command("start", async (ctx) => {
      try {
        const telegramId = ctx.from.id;
        const firstName = ctx.from.first_name;
        const lastName = ctx.from.last_name;
        const username = ctx.from.username;

        this.logger.log("========================================");
        this.logger.log("👋 /start command received");
        this.logger.log(`User ID: ${telegramId}`);
        this.logger.log(`Username: @${username || "N/A"}`);
        this.logger.log(`Name: ${firstName} ${lastName || ""}`);
        this.logger.log("========================================");

        let user = await this.userService.findByTelegramId(telegramId);
        const isNewUser = !user;

        this.logger.log(`Is new user: ${isNewUser}`);

        if (!user) {
          this.logger.log("🆕 Creating new user...");
          user = await this.userService.createOrUpdateUser({
            telegramId,
            firstName,
            lastName,
            username,
          });
          this.logger.log(`✓ New user created with ID: ${user.id}`);
        } else {
          this.logger.log(`✓ Existing user found: ${user.id}`);
          this.logger.log(`  - Language: ${user.language}`);
        }

        if (isNewUser) {
          this.logger.log("🌎 Showing language selection...");
          await ctx.reply(this.translationService.t("selectLanguage", "uz"), {
            reply_markup: this.translationService.getLanguageKeyboard(),
          });
        } else {
          const lang = user.language as Language;
          this.logger.log(`👋 Showing welcome message in ${lang}...`);
          await ctx.reply(this.translationService.t("welcome", lang), {
            reply_markup: this.keyboardService.getCategoryKeyboard(lang),
          });
        }

        await this.loggerService.log(user.id, "start_command");
        this.logger.log("✓ /start command completed successfully");
        this.logger.log("========================================");
      } catch (error) {
        this.logger.error("❌ Error in /start command");
        this.logger.error(`Error: ${error.message}`);
        this.logger.error(`Stack: ${error.stack}`);
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
          if (error.error_code !== 403) {
            // Log non-403 errors (403 = user blocked bot, which is expected)
            this.logger.warn(
              `Failed to send message to user ${user.telegramId}: ${
                error.description || error.message
              }`
            );
          }
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
          if (error.error_code !== 403) {
            this.logger.warn(
              `Failed to send to user ${user.telegramId}: ${
                error.description || error.message
              }`
            );
          }
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

    this.bot.callbackQuery(/^cat:(teachers|kabinets)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = await this.userService.findByTelegramId(ctx.from.id);
      const lang = (user?.language as Language) || "uz";

      try {
        await ctx.editMessageText(
          this.translationService.t("underDevelopment", lang),
          {
            reply_markup: this.keyboardService.getCategoryKeyboard(lang),
          }
        );
      } catch (error) {
        // Ignore "message is not modified" error - happens when user clicks same button twice
        if (!error.message?.includes("message is not modified")) {
          this.logger.error(
            "Error editing message for teachers/kabinets",
            error
          );
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
              lang
            ),
          }
        );
      }
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
        const fakultetId = ctx.match[2];
        const kursId = ctx.match[3];
        const guruh = ctx.match[4];

        // Decode short IDs back to full names
        const fakultet = this.keyboardService.decodeFacultyId(fakultetId);
        const kurs = this.keyboardService.decodeCourse(kursId);

        this.logger.log(
          `Parsed: category=${category}, fakultet=${fakultet}, kurs=${kurs}, guruh=${guruh}`
        );

        const user = await this.userService.findByTelegramId(ctx.from.id);
        const lang = (user?.language as Language) || "uz";

        await ctx.editMessageText(this.translationService.t("loading", lang));

        try {
          const url = this.keyboardService.getUrlForGroup(
            category,
            fakultetId !== "none" ? fakultetId : null,
            kursId,
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
            caption: this.formatCaption(fakultet, kurs, guruh, false),
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
        const fakultetId = ctx.match[2];
        const kursId = ctx.match[3];
        const guruh = ctx.match[4];

        // Decode short IDs
        const fakultet = this.keyboardService.decodeFacultyId(fakultetId);
        const kurs = this.keyboardService.decodeCourse(kursId);

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
            fakultetId !== "none" ? fakultetId : null,
            kursId,
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
            caption: this.formatCaption(fakultet, kurs, guruh, true),
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

      await this.safeEditMessageText(ctx, message, {
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

      await this.safeEditMessageText(ctx, message, {
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

      await this.safeEditMessageText(ctx, message, {
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

      await this.safeEditMessageText(ctx, message, {
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

      await this.safeEditMessageText(ctx, "🔄 Clearing cache...");

      try {
        const deletedCount = await this.screenshotService.clearAllCache();

        const message =
          `✅ Cache cleared successfully!\n\n` +
          `🗑 Deleted ${deletedCount} screenshots\n` +
          `💾 Database cleaned\n` +
          `🔴 Redis cleaned`;

        await this.safeEditMessageText(ctx, message, {
          reply_markup: this.keyboardService.getAdminKeyboard(lang),
        });
      } catch (error) {
        this.logger.error("Error clearing cache", error);
        await this.safeEditMessageText(
          ctx,
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

  // Helper method to safely edit messages, ignoring "message is not modified" errors
  private async safeEditMessageText(
    ctx: any,
    text: string,
    options?: any
  ): Promise<void> {
    try {
      await ctx.editMessageText(text, options);
    } catch (error) {
      // Ignore "message is not modified" errors - happens when user clicks same button twice
      if (
        error.message?.includes("message is not modified") ||
        (error.error_code === 400 &&
          error.description?.includes("message is not modified"))
      ) {
        // Silently ignore this harmless error
        return;
      }
      // Re-throw other errors
      throw error;
    }
  }

  private formatCaption(
    fakultet: string | null,
    kurs: string,
    guruh: string,
    isRefresh: boolean = false
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

    let caption = `${icon}\n🧾 ${
      fakultetName ? fakultetName + " – " : ""
    }${kurs} – ${guruh}\n`;
    caption += `🕒 ${date}, ${time}\n`;
    caption += `xatolik xaqida xabar bering - @ksh247\n`;
    caption += `📌 @tsuetimebot`;

    return caption;
  }

  getBot(): Bot<BotContext> {
    return this.bot;
  }
}
