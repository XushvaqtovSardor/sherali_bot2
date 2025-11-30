import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ScreenshotService } from "./screenshot.service";
import { BrowserService } from "./browser.service";
import { ScreenshotProcessor } from "./screenshot.processor";
import { CacheService } from "./cache.service";
import { FirebaseModule } from "../firebase/firebase.module";
import { ScreenshotCleanupService } from "./screenshot-cleanup.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "screenshot",
    }),
    FirebaseModule,
  ],
  providers: [
    ScreenshotService,
    BrowserService,
    ScreenshotProcessor,
    CacheService,
    ScreenshotCleanupService,
  ],
  exports: [ScreenshotService, CacheService],
})
export class ScreenshotModule {}
