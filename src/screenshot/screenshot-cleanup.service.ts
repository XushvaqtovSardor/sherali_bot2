import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ChannelCacheService } from "./channel-cache.service";
import * as fs from "fs/promises";
import * as path from "path";

@Injectable()
export class ScreenshotCleanupService {
  private readonly logger = new Logger(ScreenshotCleanupService.name);
  private isRunning = false;
  private readonly screenshotDir = path.join(process.cwd(), "screenshots");
  private readonly maxAgeHours = 24;

  constructor(private channelCacheService: ChannelCacheService) { }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldScreenshots() {
    await this.cleanup();
  }

  async manualCleanup(): Promise<number> {
    return await this.cleanup();
  }

  private async cleanup(): Promise<number> {
    if (this.isRunning) return 0;

    this.isRunning = true;

    try {
      await this.channelCacheService.cleanExpiredCache();

      const files = await fs.readdir(this.screenshotDir);
      const now = Date.now();
      const maxAge = this.maxAgeHours * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        if (!file.endsWith(".png") && !file.endsWith(".jpeg")) continue;

        const filePath = path.join(this.screenshotDir, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`);
      return 0;
    } finally {
      this.isRunning = false;
    }
  }
}
