import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import puppeteer, { Browser, Page } from "puppeteer";

@Injectable()
export class BrowserService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser;
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
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--disable-extensions",
          "--disable-web-security",
          "--disable-features=IsolateOrigins,site-per-process",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-accelerated-2d-canvas",
          "--memory-pressure-off",
          "--disable-blink-features=AutomationControlled",
          "--disable-features=VizDisplayCompositor",
          "--dns-prefetch-disable",
        ],
        timeout: 60000,
      });
      this.logger.log("✅ Browser initialized successfully");
    } catch (error) {
      this.logger.error("Browser init failed");
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) { }
    }
  }

  async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const page = await this.browser.newPage();

    // Set realistic user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9,uz;q=0.8,ru;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    // Increase timeouts for slow servers
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);

    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      // Block ads, fonts, and some media to speed up
      if (['font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

    return page;
  }

  getBrowser(): Browser {
    return this.browser;
  }

  private getChromePath(): string {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

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
            return path;
          }
        } catch (e) { }
      }
    } else if (platform === "darwin") {
      return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    } else {
      const possiblePaths = [
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        process.env.CHROME_BIN,
      ];

      for (const path of possiblePaths) {
        if (!path) continue;
        try {
          const fs = require("fs");
          if (fs.existsSync(path)) {
            return path;
          }
        } catch (e) { }
      }
    }

    return undefined;
  }
}
