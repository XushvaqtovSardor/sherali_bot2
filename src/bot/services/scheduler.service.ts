import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SubscriptionService } from "../services/subscription.service";
import { ScreenshotService } from "../../screenshot/screenshot.service";
import { Bot, InputFile } from "grammy";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class SchedulerService {
    private readonly logger = new Logger(SchedulerService.name);
    private bot: Bot;

    constructor(
        private subscriptionService: SubscriptionService,
        private screenshotService: ScreenshotService,
        private configService: ConfigService,
    ) {
        const token = this.configService.get<string>("BOT_TOKEN");
        this.bot = new Bot(token);
    }

    // Har daqiqada tekshirish
    @Cron("* * * * *")
    async handleScheduledMessages() {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        const subscriptions = await this.subscriptionService.getSubscriptionsByTime(currentTime);

        if (subscriptions.length === 0) {
            return;
        }

        this.logger.log(`Processing ${subscriptions.length} subscriptions for time ${currentTime}`);

        for (const sub of subscriptions) {
            try {
                const cacheKey = `${sub.category}_${sub.kurs}_${sub.guruh}`;
                const result = await this.screenshotService.getScreenshot(sub.url, cacheKey);

                const caption = this.formatCaption(sub.fakultet, sub.kurs, sub.guruh);

                await this.bot.api.sendPhoto(sub.chatId, new InputFile(result.filePath), {
                    caption,
                });

                await this.screenshotService.deleteLocalFile(result.filePath);

                this.logger.log(`Sent scheduled screenshot to chat ${sub.chatId}`);
            } catch (error) {
                this.logger.error(`Failed to send scheduled screenshot to ${sub.chatId}: ${error.message}`);
            }
        }
    }

    private formatCaption(fakultet: string | null, kurs: string, guruh: string): string {
        const now = new Date();
        const date = now.toLocaleDateString("en-GB");
        const time = now.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
        });

        let caption = `📅 ${date} | 🕐 ${time}\n\n`;

        if (fakultet && fakultet !== "none") {
            caption += `🏛 ${fakultet}\n`;
        }
        caption += `📚 ${kurs}\n`;
        caption += `👥 ${guruh}`;

        return caption;
    }
}
