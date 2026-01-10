import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { FirebaseService } from "../firebase/firebase.service";

@Injectable()
export class ScreenshotCleanupService {
  private readonly logger = new Logger(ScreenshotCleanupService.name);
  private isRunning = false;

  constructor(private firebaseService: FirebaseService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldScreenshots() {
    if (this.isRunning) {
      this.logger.warn("⚠️ Cleanup already running, skipping...");
      return;
    }

    this.isRunning = true;

    try {
      this.logger.log("========================================");
      this.logger.log("🧹 Running scheduled cleanup of old screenshots...");
      this.logger.log(`⏰ Time: ${new Date().toISOString()}`);

      // Check if Supabase is enabled
      if (!this.firebaseService.isSupabaseEnabled()) {
        this.logger.log("ℹ️ Supabase is disabled, skipping cloud cleanup");
        this.logger.log("✓ Local screenshots are managed automatically");
        this.logger.log("========================================");
        return;
      }

      this.logger.log("☁️ Starting Supabase cleanup...");
      const startTime = Date.now();

      const deletedCount = await this.firebaseService.deleteOldScreenshots(8);

      const duration = Date.now() - startTime;
      this.logger.log(`⏱️ Cleanup duration: ${duration}ms`);
      this.logger.log(
        `✅ Cleanup completed: ${deletedCount} screenshots deleted`
      );
      this.logger.log("========================================");
    } catch (error) {
      this.logger.error("========================================");
      this.logger.error("❌ Failed to cleanup old screenshots");
      this.logger.error(`Error: ${error.message}`);
      this.logger.error(`Stack: ${error.stack}`);
      this.logger.error("========================================");
    } finally {
      this.isRunning = false;
    }
  }

  // Manual cleanup trigger
  async manualCleanup(): Promise<number> {
    this.logger.log("🔧 Manual cleanup triggered");

    if (this.isRunning) {
      this.logger.warn("⚠️ Cleanup already running");
      return 0;
    }

    this.isRunning = true;

    try {
      const deletedCount = await this.firebaseService.deleteOldScreenshots(8);
      this.logger.log(`✅ Manual cleanup completed: ${deletedCount} deleted`);
      return deletedCount;
    } catch (error) {
      this.logger.error(`❌ Manual cleanup failed: ${error.message}`);
      return 0;
    } finally {
      this.isRunning = false;
    }
  }
}
