import { Module } from "@nestjs/common";
import { ScreenshotService } from "./screenshot.service";
import { BrowserService } from "./browser.service";
import { ChannelCacheService } from "./channel-cache.service";
import { ScreenshotCleanupService } from "./screenshot-cleanup.service";

@Module({
  imports: [],
  providers: [
    ScreenshotService,
    BrowserService,
    ChannelCacheService,
    ScreenshotCleanupService,
  ],
  exports: [ScreenshotService, ChannelCacheService],
})
export class ScreenshotModule {}
