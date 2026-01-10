import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { BotModule } from "../bot/bot.module";
import { ScreenshotModule } from "../screenshot/screenshot.module";

@Module({
  imports: [BotModule, ScreenshotModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
