import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class RedisService implements OnModuleInit {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private connectionAttempts = 0;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>("REDIS_URL");

    this.logger.log("========================================");
    this.logger.log("🔴 Initializing Redis connection...");

    if (!redisUrl) {
      this.logger.error("❌ REDIS_URL is not configured!");
      throw new Error("REDIS_URL environment variable is required");
    }

    this.logger.log(
      `✓ REDIS_URL loaded: ${redisUrl.replace(/:\/\/[^@]*@/, "://***@")}`
    );

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          this.connectionAttempts = times;
          this.logger.warn(`⚠ Redis connection attempt ${times}/3`);

          if (times > 3) {
            this.logger.error("========================================");
            this.logger.error("❌ Redis connection failed after 3 retries");
            this.logger.error("========================================");
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.client.on("connect", () => {
        this.logger.log("🔗 Redis connection initiated...");
      });

      this.client.on("ready", () => {
        this.logger.log("========================================");
        this.logger.log("✅ Redis connected successfully");
        this.logger.log(`✓ Connection attempts: ${this.connectionAttempts}`);
        this.logger.log("========================================");
      });

      this.client.on("error", (err) => {
        this.logger.error("========================================");
        this.logger.error("❌ Redis connection error!");
        this.logger.error(`Error: ${err.message}`);
        this.logger.error("========================================");
        this.logger.error("Possible causes:");
        this.logger.error("1. Redis server is not running");
        this.logger.error("2. Wrong REDIS_URL configuration");
        this.logger.error("3. Network connection issues");
        this.logger.error("4. Redis requires authentication");
        this.logger.error("========================================");
      });

      this.client.on("reconnecting", () => {
        this.logger.warn("⚠ Redis reconnecting...");
      });

      this.client.on("end", () => {
        this.logger.warn("⚠ Redis connection ended");
      });
    } catch (error) {
      this.logger.error("========================================");
      this.logger.error("❌ Failed to initialize Redis!");
      this.logger.error(`Error: ${error.message}`);
      this.logger.error(`Stack: ${error.stack}`);
      this.logger.error("========================================");
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(key);
      this.logger.debug(
        `🔑 Redis GET: ${key} = ${value ? "found" : "not found"}`
      );
      return value;
    } catch (error) {
      this.logger.error(`❌ Redis GET error for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
        this.logger.debug(`🔑 Redis SET: ${key} (TTL: ${ttl}s)`);
      } else {
        await this.client.set(key, value);
        this.logger.debug(`🔑 Redis SET: ${key}`);
      }
    } catch (error) {
      this.logger.error(`❌ Redis SET error for key ${key}: ${error.message}`);
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
