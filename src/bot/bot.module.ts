import { Module } from "@nestjs/common";
import { BotService } from "./bot.service";
import { UserService } from "./services/user.service";
import { KeyboardService } from "./services/keyboard.service";
import { TranslationService } from "./services/translation.service";
import { LoggerService } from "../common/services/logger.service";
import { ScreenshotModule } from "../screenshot/screenshot.module";
import { AdminModule } from "../admin/admin.module";
import { SubscriptionService } from "./services/subscription.service";
import { SchedulerService } from "./services/scheduler.service";

@Module({
  imports: [ScreenshotModule, AdminModule],
  providers: [
    BotService,
    UserService,
    KeyboardService,
    TranslationService,
    LoggerService,
    SubscriptionService,
    SchedulerService,
  ],
  exports: [BotService, UserService],
})
export class BotModule { }
