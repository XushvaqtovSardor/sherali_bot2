import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class RedisService implements OnModuleInit {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>("REDIS_URL");

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error("Redis connection failed after 3 retries");
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.client.on("connect", () => {
        this.logger.log("Redis connected successfully");
      });

      this.client.on("error", (err) => {
        this.logger.error("Redis connection error:", err.message);
      });
    } catch (error) {
      this.logger.error("Failed to initialize Redis:", error);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}:`, error.message);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}:`, error.message);
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Redis DEL error for keys:`, error.message);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(
        `Redis KEYS error for pattern ${pattern}:`,
        error.message
      );
      return [];
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS error for key ${key}:`, error.message);
      return false;
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
