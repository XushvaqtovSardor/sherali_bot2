import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ScreenshotService } from "./screenshot.service";
import { BrowserService } from "./browser.service";
import { ScreenshotProcessor } from "./screenshot.processor";
import { CacheService } from "./cache.service";
// Firebase/Supabase DISABLED - not needed anymore
// import { FirebaseModule } from "../firebase/firebase.module";
// import { ScreenshotCleanupService } from "./screenshot-cleanup.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "screenshot",
    }),
    // FirebaseModule removed - no cloud storage
  ],
  providers: [
    ScreenshotService,
    BrowserService,
    ScreenshotProcessor,
    CacheService,
    // ScreenshotCleanupService removed - no cleanup needed
  ],
  exports: [ScreenshotService, CacheService],
})
export class ScreenshotModule {}
