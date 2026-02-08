import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

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
  ) { }

  async getCacheChannelId(): Promise<string | null> {
    try {
      const channelId = this.configService.get<string>("CACHE_CHANNEL_ID");
      return channelId || null;
    } catch (error) {
      this.logger.error(`Error getting cache channel ID: ${error.message}`);
      return null;
    }
  }

  async setCacheChannelId(channelId: string): Promise<void> {
    this.logger.warn(
      `Set CACHE_CHANNEL_ID in .env file to: ${channelId}`
    );
  }

  async getCachedScreenshot(cacheKey: string): Promise<CachedScreenshot | null> {
    try {
      const cached = await this.prisma.channelCache.findUnique({
        where: { cacheKey },
      });

      if (!cached) return null;

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
    } catch (error) {
      this.logger.error(`Error saving screenshot cache: ${error.message}`);
      throw error;
    }
  }

  async deleteCacheByKey(cacheKey: string): Promise<void> {
    try {
      await this.prisma.channelCache.deleteMany({
        where: { cacheKey },
      });
    } catch (error) {
      this.logger.error(`Error deleting cache: ${error.message}`);
    }
  }

  async clearAllCache(): Promise<number> {
    try {
      const result = await this.prisma.channelCache.deleteMany({});
      return result.count;
    } catch (error) {
      this.logger.error(`Error clearing cache: ${error.message}`);
      return 0;
    }
  }

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
      return result.count;
    } catch (error) {
      this.logger.error(`Error cleaning expired cache: ${error.message}`);
      return 0;
    }
  }
}
