import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import puppeteer, { Browser, Page } from "puppeteer";

@Injectable()
export class BrowserService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser;
  private pages: Map<string, Page> = new Map();
  private readonly logger = new Logger(BrowserService.name);

  async onModuleInit() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: this.getChromePath(),
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=1920x1080",
        ],
      });
      this.logger.log("Browser initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize browser:", error.message);
      this.logger.warn("Screenshots will not be available");
    }
  }

  async onModuleDestroy() {
    if (!this.browser) return;

    try {
      for (const page of this.pages.values()) {
        await page.close();
      }
      await this.browser.close();
      this.logger.log("Browser closed");
    } catch (error) {
      this.logger.error("Error closing browser:", error.message);
    }
  }

  async getPage(key: string): Promise<Page> {
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    if (!this.pages.has(key)) {
      const page = await this.browser.newPage();
      await page.setViewport({ width: 3840, height: 2160 });
      this.pages.set(key, page);
    }
    return this.pages.get(key);
  }

  async closePage(key: string) {
    const page = this.pages.get(key);
    if (page) {
      await page.close();
      this.pages.delete(key);
    }
  }

  getBrowser(): Browser {
    return this.browser;
  }

  private getChromePath(): string {
    const platform = process.platform;

    if (platform === "win32") {
      const possiblePaths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
      ];

      for (const path of possiblePaths) {
        try {
          const fs = require("fs");
          if (fs.existsSync(path)) {
            this.logger.log(`Using Chrome at: ${path}`);
            return path;
          }
        } catch (e) {
          // continue
        }
      }
    } else if (platform === "darwin") {
      return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    } else {
      const possiblePaths = [
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
      ];

      for (const path of possiblePaths) {
        try {
          const fs = require("fs");
          if (fs.existsSync(path)) {
            this.logger.log(`Using Chrome at: ${path}`);
            return path;
          }
        } catch (e) {
          // continue
        }
      }
    }

    this.logger.warn("Chrome executable not found, using default");
    return undefined;
  }
}
