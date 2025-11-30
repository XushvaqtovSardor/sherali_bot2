import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { join } from "path";
import { PrismaModule } from "./prisma/prisma.module";
import { BotModule } from "./bot/bot.module";
import { AdminModule } from "./admin/admin.module";
import { ScreenshotModule } from "./screenshot/screenshot.module";
import { RedisModule } from "./redis/redis.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_URL?.includes("@")
          ? process.env.REDIS_URL.split("@")[1].split(":")[0]
          : "localhost",
        port: process.env.REDIS_URL?.includes("@")
          ? parseInt(process.env.REDIS_URL.split(":").pop() || "6379")
          : 6379,
        password: process.env.REDIS_URL?.includes("//default:")
          ? process.env.REDIS_URL.split("//default:")[1].split("@")[0]
          : undefined,
        retryStrategy: (times) => {
          if (times > 3) {
            console.log(
              "BullMQ Redis connection failed, continuing without queue..."
            );
            return null;
          }
          return Math.min(times * 1000, 3000);
        },
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "screenshots"),
      serveRoot: "/screenshots",
    }),
    PrismaModule,
    RedisModule,
    BotModule,
    ScreenshotModule,
    AdminModule,
  ],
})
export class AppModule {}
