import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BrowserService } from "./browser.service";
import { ChannelCacheService } from "./channel-cache.service";
import { join } from "path";
import { mkdir, unlink } from "fs/promises";

export interface ScreenshotResult {
  fileId: string | null;
  filePath: string | null;
  fromCache: boolean;
  messageId: number | null;
}

@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);

  constructor(
    private configService: ConfigService,
    private browserService: BrowserService,
    private channelCacheService: ChannelCacheService,
  ) { }

  /**
   * Get screenshot - checks channel cache first, takes new one if expired
   * Returns info about whether to use cached or new screenshot
   */
  async getScreenshot(
    url: string,
    cacheKey: string,
    forceRefresh: boolean = false,
  ): Promise<ScreenshotResult> {
    try {
      // Check if we have a cached version
      if (!forceRefresh) {
        const cached =
          await this.channelCacheService.getCachedScreenshot(cacheKey);

        if (cached && !cached.isExpired) {
          // this.logger.log(
          //   `📦 Cache hit for: ${cacheKey} (age: ${this.formatAge(
          //     cached.createdAt
          //   )})`
          // );
          return {
            fileId: cached.fileId,
            filePath: null,
            fromCache: true,
            messageId: cached.messageId,
          };
        }

        if (cached?.isExpired) {
          // this.logger.log(
          //   `⏰ Cache expired for: ${cacheKey}, taking new screenshot`
          // );
        }
      }

      // Take new screenshot
      // this.logger.log(`📸 Creating new screenshot: ${cacheKey}`);
      const filePath = await this.captureScreenshot(url, cacheKey);

      return {
        fileId: null,
        filePath,
        fromCache: false,
        messageId: null,
      };
    } catch (error) {
      // this.logger.error(`Failed to get screenshot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save cache info after posting to channel
   */
  async saveToCache(
    cacheKey: string,
    messageId: number,
    fileId: string,
  ): Promise<void> {
    await this.channelCacheService.saveScreenshotCache(
      cacheKey,
      messageId,
      fileId,
    );
  }

  /**
   * Capture screenshot using browser
   */
  private async captureScreenshot(
    url: string,
    cacheKey: string,
  ): Promise<string> {
    // this.logger.log(`Processing screenshot: ${cacheKey}`);

    const screenshotsDir = join(process.cwd(), "screenshots");
    await mkdir(screenshotsDir, { recursive: true });

    // Sanitize filename
    const sanitizedKey = this.sanitizeFilename(cacheKey);
    const filename = `${sanitizedKey}-${Date.now()}.jpeg`;
    const filepath = join(screenshotsDir, filename);

    let page: any = null;
    let retries = 3;
    let lastError: Error = null;

    while (retries >= 0) {
      try {
        await this.browserService.cleanupIdlePages(5);
        page = await this.browserService.getPage(cacheKey);

        // this.logger.log(`🌐 Navigating to ${url}`);

        // Try navigation with multiple strategies
        let navigationSuccess = false;
        const navigationStrategies = [
          { waitUntil: "domcontentloaded", timeout: 180000 },
          { waitUntil: "networkidle0", timeout: 90000 },
          { waitUntil: "load", timeout: 120000 },
        ];

        for (const strategy of navigationStrategies) {
          try {
            await page.goto(url, strategy);
            navigationSuccess = true;
            break;
          } catch (navError) {
            if (strategy === navigationStrategies[navigationStrategies.length - 1]) {
              throw navError;
            }
            // Try next strategy
            this.logger.warn(`Navigation strategy failed, trying next...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        if (!navigationSuccess) {
          throw new Error("All navigation strategies failed");
        }

        // this.logger.log(`⏳ Waiting for timetable content...`);

        // Wait for the timetable table to appear
        try {
          await page.waitForSelector(
            'table, .timetable, [class*="schedule"], [class*="table"], #schedule, #timetable',
            {
              timeout: 20000,
            },
          );
          // this.logger.log(`✓ Found timetable element`);
        } catch (e) {
          // this.logger.warn(
          //   `⚠️ Timetable selector not found, waiting for body...`
          // );
          await page.waitForSelector("body", { timeout: 15000 });
        }

        // Wait additional time for JavaScript to render content
        await page
          .waitForFunction(
            () => {
              const body = document.body;
              // Check if content has meaningful height (not just empty/loading)
              return body && body.scrollHeight > 500;
            },
            { timeout: 20000 },
          )
          .catch(() => {
            // this.logger.warn(`⚠️ Content height check timed out`);
          });

        // Additional wait for dynamic content
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // this.logger.log(`✓ Content loaded, preparing screenshot...`);

        // Hide headers, footers, etc.
        await page.evaluate(() => {
          const selectors = [
            "header",
            ".header",
            '[class*="header"]',
            '[id*="header"]',
            "nav",
            ".nav",
            ".navbar",
            "footer",
            ".footer",
            '[class*="footer"]',
            '[id*="footer"]',
            '[class*="contact"]',
            '[class*="bottom"]',
          ];
          selectors.forEach((selector) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(
              (el) => ((el as HTMLElement).style.display = "none"),
            );
          });
        });

        // this.logger.log(`📸 Capturing screenshot...`);
        await page.screenshot({
          path: filepath as `${string}.jpeg`,
          type: "jpeg",
          quality: 100,
          fullPage: true,
          timeout: 60000,
        });

        // this.logger.log(`💾 Screenshot saved: ${filename}`);

        await this.browserService.closePage(cacheKey);
        this.browserService.incrementScreenshotCount();

        return filepath;
      } catch (error) {
        lastError = error;
        retries--;

        // Detailed error logging
        const errorDetails = this.getErrorDetails(error);
        this.logger.error(
          `⚠️ Screenshot failed (${3 - retries}/4): ${errorDetails}`,
        );

        if (page) {
          try {
            await this.browserService.closePage(cacheKey);
          } catch (e) {
            // ignore
          }
        }

        if (retries < 0) {
          throw lastError;
        }

        // Progressive wait time with longer delays for network issues
        const waitTime = (3 - retries) * 10000;
        this.logger.log(`⏳ Waiting ${waitTime / 1000}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    throw lastError || new Error("Failed to capture screenshot");
  }

  private getErrorDetails(error: any): string {
    const message = error.message || String(error);

    if (message.includes("ERR_CONNECTION_TIMED_OUT")) {
      return "Network connection timeout - server may have slow internet or firewall blocking";
    }
    if (message.includes("ERR_NAME_NOT_RESOLVED")) {
      return "DNS resolution failed - check server DNS settings";
    }
    if (message.includes("ERR_CONNECTION_REFUSED")) {
      return "Connection refused - target server may be down";
    }
    if (message.includes("Navigation timeout")) {
      return "Page load timeout - website too slow or unreachable";
    }
    if (message.includes("net::")) {
      return `Network error: ${message}`;
    }

    return message;
  }

  /**
   * Delete local file after uploading to channel
   */
  async deleteLocalFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
      // this.logger.log(`🗑️ Deleted local file: ${filePath}`);
    } catch (error) {
      // this.logger.warn(`Could not delete file: ${filePath}`);
    }
  }

  /**
   * Get all cached screenshots
   */
  async getAllCachedScreenshots() {
    return this.channelCacheService.getAllCached();
  }

  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<number> {
    return this.channelCacheService.clearAllCache();
  }

  /**
   * Get cache channel ID
   */
  async getCacheChannelId(): Promise<string | null> {
    return this.channelCacheService.getCacheChannelId();
  }

  /**
   * Set cache channel ID
   */
  async setCacheChannelId(channelId: string): Promise<void> {
    return this.channelCacheService.setCacheChannelId(channelId);
  }

  private sanitizeFilename(key: string): string {
    return key
      .replace(/[\/\\:]/g, "_")
      .replace(/[А-Яа-яЁё]/g, (char) => {
        const translitMap: Record<string, string> = {
          А: "A",
          Б: "B",
          В: "V",
          Г: "G",
          Д: "D",
          Е: "E",
          Ё: "Yo",
          Ж: "Zh",
          З: "Z",
          И: "I",
          Й: "Y",
          К: "K",
          Л: "L",
          М: "M",
          Н: "N",
          О: "O",
          П: "P",
          Р: "R",
          С: "S",
          Т: "T",
          У: "U",
          Ф: "F",
          Х: "Kh",
          Ц: "Ts",
          Ч: "Ch",
          Ш: "Sh",
          Щ: "Shch",
          Ъ: "",
          Ы: "Y",
          Ь: "",
          Э: "E",
          Ю: "Yu",
          Я: "Ya",
          а: "a",
          б: "b",
          в: "v",
          г: "g",
          д: "d",
          е: "e",
          ё: "yo",
          ж: "zh",
          з: "z",
          и: "i",
          й: "y",
          к: "k",
          л: "l",
          м: "m",
          н: "n",
          о: "o",
          п: "p",
          р: "r",
          с: "s",
          т: "t",
          у: "u",
          ф: "f",
          х: "kh",
          ц: "ts",
          ч: "ch",
          ш: "sh",
          щ: "shch",
          ъ: "",
          ы: "y",
          ь: "",
          э: "e",
          ю: "yu",
          я: "ya",
        };
        return translitMap[char] || char;
      })
      .replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  private formatAge(date: Date): string {
    const age = Date.now() - date.getTime();
    const hours = Math.floor(age / (1000 * 60 * 60));
    const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }
}
