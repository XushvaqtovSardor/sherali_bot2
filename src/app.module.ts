import { Module, Logger } from "@nestjs/common";
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
import { HealthModule } from "./health/health.module";
const logger = new Logger("AppModule");

// Parse Redis URL to extract connection details
function parseRedisUrl(redisUrl: string) {
  try {
    if (!redisUrl) {
      logger.warn("⚠ REDIS_URL not configured, using defaults");
      return { host: "localhost", port: 6379, password: undefined };
    }

    // Format: redis://[:password@]host:port
    const url = new URL(redisUrl);
    const host = url.hostname || "localhost";
    const port = parseInt(url.port) || 6379;
    const password = url.password || undefined;

    logger.log(
      `🔴 Redis config parsed: ${host}:${port} (password: ${
        password ? "yes" : "no"
      })`
    );
    return { host, port, password };
  } catch (error) {
    logger.error(`❌ Failed to parse REDIS_URL: ${error.message}`);
    logger.warn("⚠ Using default Redis config: localhost:6379");
    return { host: "localhost", port: 6379, password: undefined };
  }
}

const redisConfig = parseRedisUrl(process.env.REDIS_URL);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        retryStrategy: (times) => {
          logger.warn(`⚠ BullMQ Redis retry attempt ${times}/3`);
          if (times > 3) {
            logger.error(
              "❌ BullMQ Redis connection failed, continuing without queue..."
            );
            return null;
          }
          return Math.min(times * 1000, 3000);
        },
        reconnectOnError: (err) => {
          logger.error(`❌ BullMQ Redis error: ${err.message}`);
          return true;
        },
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "screenshots"),
      serveRoot: "/screenshots",
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    BotModule,
    ScreenshotModule,
    AdminModule,
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
