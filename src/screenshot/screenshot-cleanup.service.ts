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

  constructor(private channelCacheService: ChannelCacheService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldScreenshots() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      // Clean expired cache entries from database
      await this.channelCacheService.cleanExpiredCache();

      // Clean old local files
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

      // if (deletedCount > 0) {
      //   this.logger.log(`Cleaned up ${deletedCount} old screenshots`);
      // }
    } catch (error) {
      this.logger.error(`Failed to cleanup screenshots: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  async manualCleanup(): Promise<number> {
    if (this.isRunning) {
      return 0;
    }

    this.isRunning = true;

    try {
      // Clean expired cache
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

      // this.logger.log(`Manual cleanup: deleted ${deletedCount} screenshots`);
      return deletedCount;
    } catch (error) {
      this.logger.error(`Manual cleanup failed: ${error.message}`);
      return 0;
    } finally {
      this.isRunning = false;
    }
  }
}
