import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { BotModule } from "../bot/bot.module";
import { ScreenshotModule } from "../screenshot/screenshot.module";
import { LoggerService } from "../common/services/logger.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN") || "7d",
        },
      }),
    }),
    BotModule,
    ScreenshotModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AuthService, JwtStrategy, LoggerService],
})
export class AdminModule {}
