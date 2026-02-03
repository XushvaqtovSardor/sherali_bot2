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
  private isRestarting = false;
  private lastRestartTime = 0;
  private screenshotCount = 0;

  async onModuleInit() {
    const configs = [
      {
        name: "Standard (recommended)",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-web-security",
          "--window-size=1920x1080",
        ],
      },
      {
        name: "Minimal (fallback)",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      },
    ];

    for (const config of configs) {
      try {
        // this.logger.log(`Trying browser config: ${config.name}`);

        this.browser = await puppeteer.launch({
          headless: true,
          executablePath: this.getChromePath(),
          args: config.args,
          protocolTimeout: 60000,
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
          ignoreDefaultArgs: ["--disable-extensions"],
        });

        // Test if browser is working
        const version = await this.browser.version();
        // this.logger.log(`✅ Browser initialized successfully: ${version}`);
        return; // Success!
      } catch (error) {
        // this.logger.warn(`❌ Config "${config.name}" failed: ${error.message}`);
        if (this.browser) {
          try {
            await this.browser.close();
          } catch (e) {}
          this.browser = null;
        }
      }
    }

    // All configs failed
    this.logger.error(
      "💥 CRITICAL: All browser configurations failed! Screenshots will not work.",
    );
    this.logger.error(
      "Please ensure Chrome/Chromium is installed on the server:",
    );
    this.logger.error("  Ubuntu/Debian: apt-get install chromium-browser");
    this.logger.error("  Alpine: apk add chromium");
  }

  async onModuleDestroy() {
    if (!this.browser) return;

    try {
      for (const page of this.pages.values()) {
        await page.close();
      }
      await this.browser.close();
      // this.logger.log("Browser closed");
    } catch (error) {
      this.logger.error("Error closing browser:", error.message);
    }
  }

  async getPage(key: string): Promise<Page> {
    // Check browser health and restart if needed
    await this.ensureBrowserHealthy();

    if (!this.browser) {
      throw new Error(
        "Browser not initialized - Chrome/Chromium may not be installed on server",
      );
    }

    // Check if page exists and is still valid
    const existingPage = this.pages.get(key);
    if (existingPage) {
      try {
        // Test if page is still valid by checking if it's closed
        if (existingPage.isClosed()) {
          // this.logger.warn(`Page for ${key} was closed, creating new one`);
          this.pages.delete(key);
        } else {
          return existingPage;
        }
      } catch (error) {
        // this.logger.warn(`Page for ${key} is invalid, creating new one`);
        this.pages.delete(key);
      }
    }

    // Create new page
    const page = await this.browser.newPage();

    // Set longer timeout for slow servers
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);

    await page.setViewport({ width: 3840, height: 2160 });

    // Handle page crash events
    page.on("error", (error) => {
      // this.logger.error(`Page error for ${key}:`, error.message);
      this.pages.delete(key);
    });

    // Handle console errors from the page
    page.on("pageerror", (error: Error) => {
      // this.logger.warn(`Page console error for ${key}:`, error.message);
    });

    // Disable unnecessary features to save memory
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      // Block unnecessary resources to speed up and reduce memory
      const resourceType = request.resourceType();
      if (["font", "media", "websocket"].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    this.pages.set(key, page);
    return page;
  }
  async closePage(key: string): Promise<void> {
    const page = this.pages.get(key);
    if (page) {
      try {
        if (!page.isClosed()) {
          // Remove all event listeners before closing
          page.removeAllListeners();
          await page.close();
        }
      } catch (error) {
        // this.logger.warn(`Error closing page ${key}:`, error.message);
      } finally {
        this.pages.delete(key);
      }
    }
  }

  // Add method to periodically clean up old pages
  async cleanupIdlePages(maxPages: number = 10): Promise<void> {
    if (this.pages.size <= maxPages) {
      return;
    }

    // Close oldest pages when we exceed the limit
    const pagesToClose = this.pages.size - maxPages;
    const keys = Array.from(this.pages.keys());

    for (let i = 0; i < pagesToClose; i++) {
      const key = keys[i];
      await this.closePage(key);
      // this.logger.log(`Cleaned up idle page: ${key}`);
    }
  }

  async ensureBrowserHealthy(): Promise<void> {
    // Restart browser every 50 screenshots or if connection seems dead
    const shouldRestart =
      this.screenshotCount >= 50 || (await this.isBrowserDead());

    if (shouldRestart && !this.isRestarting) {
      const timeSinceLastRestart = Date.now() - this.lastRestartTime;
      // Prevent rapid restarts (min 30 seconds between restarts)
      if (timeSinceLastRestart > 30000) {
        // this.logger.warn(
        //   `Restarting browser (screenshot count: ${this.screenshotCount})`
        // );
        await this.restartBrowser();
      }
    }
  }

  async isBrowserDead(): Promise<boolean> {
    try {
      if (!this.browser || !this.browser.connected) {
        return true;
      }
      // Try to get browser version as a health check
      await this.browser.version();
      return false;
    } catch (error) {
      // this.logger.warn(`Browser health check failed: ${error.message}`);
      return true;
    }
  }

  async restartBrowser(): Promise<void> {
    this.isRestarting = true;

    try {
      // Close all pages first
      for (const [key, page] of this.pages.entries()) {
        try {
          if (!page.isClosed()) {
            page.removeAllListeners();
            await page.close();
          }
        } catch (e) {
          // ignore
        }
      }
      this.pages.clear();

      // Close old browser
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (e) {
          // this.logger.warn(`Error closing old browser: ${e.message}`);
        }
      }

      // Wait a bit before restarting
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Reinitialize browser
      await this.onModuleInit();

      this.screenshotCount = 0;
      this.lastRestartTime = Date.now();
      // this.logger.log("Browser restarted successfully");
    } catch (error) {
      this.logger.error(`Failed to restart browser: ${error.message}`);
    } finally {
      this.isRestarting = false;
    }
  }

  incrementScreenshotCount(): void {
    this.screenshotCount++;
  }

  getBrowser(): Browser {
    return this.browser;
  }

  private getChromePath(): string {
    // Check environment variable first (from Dockerfile)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
      // this.logger.log(`Using Chrome from env: ${envPath}`);
      return envPath;
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
            // this.logger.log(`✅ Using Chrome at: ${path}`);
            return path;
          }
        } catch (e) {
          // continue
        }
      }
    } else if (platform === "darwin") {
      return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    } else {
      // Linux - try multiple common paths
      const possiblePaths = [
        "/usr/bin/chromium-browser", // Alpine, Debian
        "/usr/bin/chromium", // Some distros
        "/usr/bin/google-chrome", // Ubuntu with Chrome
        "/usr/bin/google-chrome-stable",
        process.env.CHROME_BIN, // Custom env var
      ];

      for (const path of possiblePaths) {
        if (!path) continue;

        try {
          const fs = require("fs");
          if (fs.existsSync(path)) {
            // this.logger.log(`✅ Using Chrome at: ${path}`);
            return path;
          }
        } catch (e) {
          // continue
        }
      }
    }

    // this.logger.warn("⚠️ Chrome executable not found, using Puppeteer default");
    // this.logger.warn("If browser fails to start, install Chrome/Chromium:");
    // this.logger.warn("  Docker/Alpine: apk add chromium");
    // this.logger.warn("  Ubuntu/Debian: apt-get install chromium-browser");
    return undefined;
  }
}
