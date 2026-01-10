import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { ConfigService } from "@nestjs/config";
// Firebase/Supabase DISABLED
// import { FirebaseService } from "../firebase/firebase.service";
import { unlink } from "fs/promises";

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cacheDuration: number;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private configService: ConfigService
  ) {
    this.cacheDuration = parseInt(
      this.configService.get<string>("SCREENSHOT_CACHE_DURATION") || "28800000"
    );
  }

  async getScreenshot(
    fakultet: string,
    kurs: string,
    guruh: string
  ): Promise<string | null> {
    const redisKey = `screenshot:${fakultet}:${kurs}:${guruh}`;

    try {
      const cached = await this.redis.get(redisKey);
      if (cached) {
        this.logger.log(`Redis cache hit: ${redisKey}`);
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Redis unavailable, using PostgreSQL only`);
    }

    try {
      const dbCache = await this.prisma.jadvalCache.findUnique({
        where: {
          fakultet_kurs_guruh: { fakultet, kurs, guruh },
        },
      });

      if (dbCache && dbCache.expiresAt > new Date()) {
        this.logger.log(`PostgreSQL cache hit: ${redisKey}`);

        try {
          await this.redis.set(
            redisKey,
            dbCache.screenshotPath,
            Math.floor((dbCache.expiresAt.getTime() - Date.now()) / 1000)
          );
        } catch (error) {
          this.logger.warn(`Could not restore to Redis cache`);
        }

        return dbCache.screenshotPath;
      }
    } catch (error) {
      this.logger.error(`Database error in getScreenshot:`, error.message);
    }

    return null;
  }

  async getScreenshotByKey(cacheKey: string): Promise<string | null> {
    const redisKey = `screenshot:${cacheKey}`;

    try {
      const cached = await this.redis.get(redisKey);
      if (cached) {
        this.logger.log(`Redis cache hit: ${redisKey}`);
        return cached;
      }
    } catch (error) {
      this.logger.warn(`Redis unavailable, using PostgreSQL only`);
    }

    try {
      const dbCache = await this.prisma.jadvalCache.findFirst({
        where: {
          fakultet: cacheKey,
        },
      });

      if (dbCache && dbCache.expiresAt > new Date()) {
        this.logger.log(`PostgreSQL cache hit: ${redisKey}`);

        try {
          await this.redis.set(
            redisKey,
            dbCache.screenshotPath,
            Math.floor((dbCache.expiresAt.getTime() - Date.now()) / 1000)
          );
        } catch (error) {
          this.logger.warn(`Could not restore to Redis cache`);
        }

        return dbCache.screenshotPath;
      }
    } catch (error) {
      this.logger.error(`Database error in getScreenshotByKey:`, error.message);
    }

    return null;
  }

  async saveScreenshot(
    fakultet: string,
    kurs: string,
    guruh: string,
    screenshotPath: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + this.cacheDuration);
    const redisKey = `screenshot:${fakultet}:${kurs}:${guruh}`;

    try {
      await this.prisma.jadvalCache.upsert({
        where: {
          fakultet_kurs_guruh: { fakultet, kurs, guruh },
        },
        update: {
          screenshotPath,
          expiresAt,
        },
        create: {
          fakultet,
          kurs,
          guruh,
          screenshotPath,
          expiresAt,
        },
      });
      this.logger.log(`Saved to PostgreSQL: ${redisKey}`);
    } catch (error) {
      this.logger.error(`Database error in saveScreenshot:`, error.message);
      throw error;
    }

    try {
      await this.redis.set(
        redisKey,
        screenshotPath,
        Math.floor(this.cacheDuration / 1000)
      );
      this.logger.log(`Saved to Redis: ${redisKey}`);
    } catch (error) {
      this.logger.warn(
        `Could not save to Redis, continuing with PostgreSQL only`
      );
    }
  }

  async saveScreenshotByKey(
    cacheKey: string,
    screenshotPath: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + this.cacheDuration);
    const redisKey = `screenshot:${cacheKey}`;

    try {
      await this.prisma.jadvalCache.upsert({
        where: {
          fakultet_kurs_guruh: {
            fakultet: cacheKey,
            kurs: "cache",
            guruh: "key",
          },
        },
        update: {
          screenshotPath,
          expiresAt,
        },
        create: {
          fakultet: cacheKey,
          kurs: "cache",
          guruh: "key",
          screenshotPath,
          expiresAt,
        },
      });
      this.logger.log(`Saved to PostgreSQL: ${redisKey}`);
    } catch (error) {
      this.logger.error(
        `Database error in saveScreenshotByKey:`,
        error.message
      );
      throw error;
    }

    try {
      await this.redis.set(
        redisKey,
        screenshotPath,
        Math.floor(this.cacheDuration / 1000)
      );
      this.logger.log(`Saved to Redis: ${redisKey}`);
    } catch (error) {
      this.logger.warn(
        `Could not save to Redis, continuing with PostgreSQL only`
      );
    }
  }

  async deleteScreenshot(
    fakultet: string,
    kurs: string,
    guruh: string
  ): Promise<void> {
    const redisKey = `screenshot:${fakultet}:${kurs}:${guruh}`;

    try {
      const cached = await this.prisma.jadvalCache.findUnique({
        where: {
          fakultet_kurs_guruh: { fakultet, kurs, guruh },
        },
      });

      if (cached) {
        // Delete local file only (no Supabase)
        if (
          cached.screenshotPath &&
          !cached.screenshotPath.startsWith("http")
        ) {
          try {
            await unlink(cached.screenshotPath);
            this.logger.log(`Deleted local file: ${cached.screenshotPath}`);
          } catch (error) {
            this.logger.warn("Could not delete local file", error.message);
          }
        }

        await this.prisma.jadvalCache.delete({
          where: {
            fakultet_kurs_guruh: { fakultet, kurs, guruh },
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error deleting from database:`, error.message);
    }

    try {
      await this.redis.del(redisKey);
    } catch (error) {
      this.logger.warn(`Could not delete from Redis`);
    }
  }

  async deleteScreenshotByKey(cacheKey: string): Promise<void> {
    const redisKey = `screenshot:${cacheKey}`;

    try {
      const cached = await this.prisma.jadvalCache.findFirst({
        where: {
          fakultet: cacheKey,
        },
      });

      if (cached) {
        // Delete local file only (no Supabase)
        if (
          cached.screenshotPath &&
          !cached.screenshotPath.startsWith("http")
        ) {
          try {
            await unlink(cached.screenshotPath);
            this.logger.log(`Deleted local file: ${cached.screenshotPath}`);
          } catch (error) {
            this.logger.warn("Could not delete local file", error.message);
          }
        }

        await this.prisma.jadvalCache.delete({
          where: {
            id: cached.id,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Error deleting from database:`, error.message);
    }

    try {
      await this.redis.del(redisKey);
    } catch (error) {
      this.logger.warn(`Could not delete from Redis`);
    }
  }

  async getAllCached() {
    try {
      return await this.prisma.jadvalCache.findMany({
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      this.logger.error(`Error getting all cached:`, error.message);
      return [];
    }
  }

  async cleanExpiredCache() {
    try {
      const expired = await this.prisma.jadvalCache.findMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      for (const cache of expired) {
        // Delete local file only (no Supabase)
        if (cache.screenshotPath && !cache.screenshotPath.startsWith("http")) {
          try {
            await unlink(cache.screenshotPath);
            this.logger.log(`Deleted local file: ${cache.screenshotPath}`);
          } catch (error) {
            this.logger.warn("Could not delete local file", error.message);
          }
        }

        await this.prisma.jadvalCache.delete({
          where: { id: cache.id },
        });
      }

      this.logger.log(`Cleaned ${expired.length} expired cache entries`);
    } catch (error) {
      this.logger.error(`Error cleaning expired cache:`, error.message);
    }
  }

  async clearAllCache(): Promise<number> {
    try {
      // Delete local files (no Supabase)
      const allCached = await this.prisma.jadvalCache.findMany();
      let deletedCount = 0;

      for (const cache of allCached) {
        if (cache.screenshotPath && !cache.screenshotPath.startsWith("http")) {
          try {
            await unlink(cache.screenshotPath);
            deletedCount++;
          } catch (error) {
            this.logger.warn(`Could not delete file: ${cache.screenshotPath}`);
          }
        }
      }

      await this.prisma.jadvalCache.deleteMany({});
      await this.prisma.log.deleteMany({});
      await this.prisma.choice.deleteMany({});

      try {
        const keys = await this.redis.keys("screenshot:*");
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        this.logger.warn("Could not clear Redis cache");
      }

      this.logger.log(`Cleared all cache: ${deletedCount} files deleted`);
      return deletedCount;
    } catch (error) {
      this.logger.error(`Error clearing all cache:`, error.message);
      return 0;
    }
  }
}
