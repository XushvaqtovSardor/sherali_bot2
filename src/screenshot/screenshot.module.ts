import { Module } from "@nestjs/common";
import { ScreenshotService } from "./screenshot.service";
import { BrowserService } from "./browser.service";
import { CacheService } from "./cache.service";

@Module({
  imports: [],
  providers: [ScreenshotService, BrowserService, CacheService],
  exports: [ScreenshotService, CacheService],
})
export class ScreenshotModule {}
