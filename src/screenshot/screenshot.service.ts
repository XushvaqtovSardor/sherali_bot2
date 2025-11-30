import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { CacheService } from "./cache.service";
import { ConfigService } from "@nestjs/config";
import { join } from "path";
import { existsSync } from "fs";

export interface ScreenshotJobData {
  url: string;
  cacheKey: string;
}

@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);

  constructor(
    @InjectQueue("screenshot") private screenshotQueue: Queue,
    private cacheService: CacheService,
    private configService: ConfigService
  ) {}

  async getOrCreateScreenshot(
    url: string,
    cacheKey: string,
    forceRefresh: boolean = false
  ): Promise<string> {
    if (!forceRefresh) {
      const cached = await this.cacheService.getScreenshotByKey(cacheKey);
      if (cached) {
        this.logger.log(`Screenshot cache hit: ${cacheKey}`);
        return cached;
      }
    } else {
      await this.cacheService.deleteScreenshotByKey(cacheKey);
    }

    this.logger.log(`Screenshot cache miss: ${cacheKey}, adding to queue`);

    // Add job to queue
    await this.screenshotQueue.add("capture", {
      url,
      cacheKey,
    });

    // Poll cache for result (check every 500ms, max 60 seconds)
    const maxAttempts = 120; // 120 * 500ms = 60 seconds
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await this.cacheService.getScreenshotByKey(cacheKey);
      if (result) {
        this.logger.log(`Screenshot ready: ${cacheKey}`);
        return result;
      }
    }

    throw new Error(`Screenshot timeout for ${cacheKey}`);
  }

  async forceRefresh(url: string, cacheKey: string): Promise<string> {
    return this.getOrCreateScreenshot(url, cacheKey, true);
  }

  async getAllCachedScreenshots() {
    return this.cacheService.getAllCached();
  }

  async clearAllCache(): Promise<number> {
    return this.cacheService.clearAllCache();
  }
}
