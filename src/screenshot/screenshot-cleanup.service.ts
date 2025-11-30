import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { FirebaseService } from "../firebase/firebase.service";

@Injectable()
export class ScreenshotCleanupService {
  private readonly logger = new Logger(ScreenshotCleanupService.name);

  constructor(private firebaseService: FirebaseService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldScreenshots() {
    this.logger.log("Running scheduled cleanup of old screenshots...");

    try {
      const deletedCount = await this.firebaseService.deleteOldScreenshots(8);
      this.logger.log(`Cleanup completed: ${deletedCount} screenshots deleted`);
    } catch (error) {
      this.logger.error("Failed to cleanup old screenshots", error);
    }
  }
}
