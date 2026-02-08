import { Module } from "@nestjs/common";
import { ScreenshotService } from "./screenshot.service";
import { BrowserService } from "./browser.service";

@Module({
  imports: [],
  providers: [
    ScreenshotService,
    BrowserService,
  ],
  exports: [ScreenshotService],
})
export class ScreenshotModule { }
