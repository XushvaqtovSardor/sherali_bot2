import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BrowserService } from "./browser.service";
import { ChannelCacheService } from "./channel-cache.service";
import { join } from "path";
import { mkdir, unlink } from "fs/promises";

export interface ScreenshotResult {
  fileId: string | null;
  filePath: string | null;
  fromCache: boolean;
  messageId: number | null;
}

@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);

  constructor(
    private configService: ConfigService,
    private browserService: BrowserService,
    private channelCacheService: ChannelCacheService,
  ) {}

  async getScreenshot(
    url: string,
    cacheKey: string,
    forceRefresh: boolean = false,
  ): Promise<ScreenshotResult> {
    try {
      if (!forceRefresh) {
        const cached = await this.channelCacheService.getCachedScreenshot(cacheKey);

        if (cached && !cached.isExpired) {
          return {
            fileId: cached.fileId,
            filePath: null,
            fromCache: true,
            messageId: cached.messageId,
          };
        }
      }

      const filePath = await this.captureScreenshot(url, cacheKey);

      return {
        fileId: null,
        filePath,
        fromCache: false,
        messageId: null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Screenshot error: ${errorMessage}`);
      throw error;
    }
  }

  async saveToCache(
    cacheKey: string,
    messageId: number,
    fileId: string,
  ): Promise<void> {
    await this.channelCacheService.saveScreenshotCache(cacheKey, messageId, fileId);
  }

  private async captureScreenshot(
    url: string,
    cacheKey: string,
  ): Promise<string> {
    const screenshotsDir = join(process.cwd(), "screenshots");
    await mkdir(screenshotsDir, { recursive: true });

    const sanitizedKey = this.sanitizeFilename(cacheKey);
    const filename = `${sanitizedKey}-${Date.now()}.jpeg`;
    const filepath = join(screenshotsDir, filename);

    const page = await this.browserService.createPage();

    try {
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 60000,
      });

      await page.waitForSelector("body", { timeout: 10000 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await page.screenshot({
        path: filepath as `${string}.jpeg`,
        type: "jpeg",
        quality: 90,
        fullPage: true,
      });

      return filepath;
    } finally {
      await page.close().catch(() => {});
    }
  }

  async deleteLocalFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch (error) {}
  }

  async getAllCachedScreenshots() {
    return this.channelCacheService.getAllCached();
  }

  async clearAllCache(): Promise<number> {
    return this.channelCacheService.clearAllCache();
  }

  async getCacheChannelId(): Promise<string | null> {
    return this.channelCacheService.getCacheChannelId();
  }

  async setCacheChannelId(channelId: string): Promise<void> {
    return this.channelCacheService.setCacheChannelId(channelId);
  }

  private sanitizeFilename(key: string): string {
    return key.replace(/[\/\\:]/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
  }
}