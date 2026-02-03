import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

// Cache duration: 5 hours in milliseconds
const CACHE_DURATION_MS = 5 * 60 * 60 * 1000;

export interface CachedScreenshot {
  messageId: number;
  fileId: string;
  createdAt: Date;
  isExpired: boolean;
}

@Injectable()
export class ChannelCacheService {
  private readonly logger = new Logger(ChannelCacheService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  /**
   * Get the cache channel ID from environment variable
   */
  async getCacheChannelId(): Promise<string | null> {
    try {
      const channelId = this.configService.get<string>("CACHE_CHANNEL_ID");
      return channelId || null;
    } catch (error) {
      this.logger.error(`Error getting cache channel ID: ${error.message}`);
      return null;
    }
  }

  /**
   * Set the cache channel ID (note: this only logs the value, actual setting should be done via env variable)
   */
  async setCacheChannelId(channelId: string): Promise<void> {
    this.logger.warn(
      `Setting cache channel ID dynamically is not supported. Please set CACHE_CHANNEL_ID in .env file to: ${channelId}`
    );
  }

  /**
   * Get cached screenshot info by cache key
   * Returns null if not found or expired
   */
  async getCachedScreenshot(
    cacheKey: string
  ): Promise<CachedScreenshot | null> {
    try {
      const cached = await this.prisma.channelCache.findUnique({
        where: { cacheKey },
      });

      if (!cached) {
        return null;
      }

      const now = new Date();
      const age = now.getTime() - cached.createdAt.getTime();
      const isExpired = age > CACHE_DURATION_MS;

      return {
        messageId: cached.messageId,
        fileId: cached.fileId,
        createdAt: cached.createdAt,
        isExpired,
      };
    } catch (error) {
      this.logger.error(`Error getting cached screenshot: ${error.message}`);
      return null;
    }
  }

  /**
   * Save screenshot cache info
   */
  async saveScreenshotCache(
    cacheKey: string,
    messageId: number,
    fileId: string
  ): Promise<void> {
    try {
      await this.prisma.channelCache.upsert({
        where: { cacheKey },
        update: {
          messageId,
          fileId,
          createdAt: new Date(),
        },
        create: {
          cacheKey,
          messageId,
          fileId,
        },
      });
      // this.logger.log(`Saved cache for: ${cacheKey}, messageId: ${messageId}`);
    } catch (error) {
      this.logger.error(`Error saving screenshot cache: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete cached screenshot by key
   */
  async deleteCacheByKey(cacheKey: string): Promise<void> {
    try {
      await this.prisma.channelCache.deleteMany({
        where: { cacheKey },
      });
    } catch (error) {
      this.logger.error(`Error deleting cache: ${error.message}`);
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<number> {
    try {
      const result = await this.prisma.channelCache.deleteMany({});
      // this.logger.log(`Cleared ${result.count} cached screenshots`);
      return result.count;
    } catch (error) {
      this.logger.error(`Error clearing cache: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get all cached items
   */
  async getAllCached() {
    try {
      return await this.prisma.channelCache.findMany({
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      this.logger.error(`Error getting all cached: ${error.message}`);
      return [];
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache(): Promise<number> {
    try {
      const expiryDate = new Date(Date.now() - CACHE_DURATION_MS);
      const result = await this.prisma.channelCache.deleteMany({
        where: {
          createdAt: {
            lt: expiryDate,
          },
        },
      });
      if (result.count > 0) {
        // this.logger.log(`Cleaned ${result.count} expired cache entries`);
      }
      return result.count;
    } catch (error) {
      this.logger.error(`Error cleaning expired cache: ${error.message}`);
      return 0;
    }
  }
}
