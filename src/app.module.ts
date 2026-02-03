import { Module, Logger } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ScheduleModule } from "@nestjs/schedule";
import { join } from "path";
import { PrismaModule } from "./prisma/prisma.module";
import { BotModule } from "./bot/bot.module";
import { AdminModule } from "./admin/admin.module";
import { ScreenshotModule } from "./screenshot/screenshot.module";
import { HealthModule } from "./health/health.module";
const logger = new Logger("AppModule");

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "screenshots"),
      serveRoot: "/screenshots",
    }),
    PrismaModule,
    BotModule,
    ScreenshotModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {
  constructor() {
    logger.log("========================================");
    logger.log("🚀 Application module initialized");
    logger.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    logger.log("========================================");
  }
}
