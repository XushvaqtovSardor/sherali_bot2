import { Module } from "@nestjs/common";
import { BotService } from "./bot.service";
import { UserService } from "./services/user.service";
import { KeyboardService } from "./services/keyboard.service";
import { TranslationService } from "./services/translation.service";
import { LoggerService } from "../common/services/logger.service";
import { ScreenshotModule } from "../screenshot/screenshot.module";

@Module({
  imports: [ScreenshotModule],
  providers: [
    BotService,
    UserService,
    KeyboardService,
    TranslationService,
    LoggerService,
  ],
  exports: [BotService, UserService],
})
export class BotModule {}
