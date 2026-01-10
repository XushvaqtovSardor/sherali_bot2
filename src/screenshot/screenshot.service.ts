import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { CacheService } from "./cache.service";
import { ConfigService } from "@nestjs/config";
import { BrowserService } from "./browser.service";
// Firebase/Supabase DISABLED
// import { FirebaseService } from "../firebase/firebase.service";
import { join } from "path";
import { existsSync } from "fs";
import { mkdir, unlink } from "fs/promises";

export interface ScreenshotJobData {
  url: string;
  cacheKey: string;
}

@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);

  constructor(
    @InjectQueue("screenshot") private screenshotQueue: Queue,
    private cacheService: CacheService,
    private configService: ConfigService,
    private browserService: BrowserService
  ) {}

  async getOrCreateScreenshot(
    url: string,
    cacheKey: string,
    forceRefresh: boolean = false
  ): Promise<string> {
    try {
      // CACHE DISABLED: Always capture new screenshot
      this.logger.log(`📸 Creating new screenshot: ${cacheKey}`);

      // Delete old cached version if exists
      await this.cacheService.deleteScreenshotByKey(cacheKey);

      this.logger.log(`🔄 Adding to queue: ${cacheKey}`);

      // Add job to queue
      await this.screenshotQueue.add("capture", {
        url,
        cacheKey,
      });

      // Poll cache for result (check every 500ms, max 60 seconds)
      const maxAttempts = 120; // 120 * 500ms = 60 seconds
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const result = await this.cacheService.getScreenshotByKey(cacheKey);
        if (result) {
          this.logger.log(`Screenshot ready: ${cacheKey}`);
          return result;
        }
      }

      // If queue timeout, try direct capture as fallback
      this.logger.warn(
        `⚠️ Screenshot queue timeout for ${cacheKey}, attempting DIRECT CAPTURE`
      );
      return await this.captureDirectScreenshot(url, cacheKey);
    } catch (error) {
      this.logger.error(
        `❌ Primary screenshot failed for ${cacheKey}: ${error.message}`
      );
      this.logger.error(`Error stack: ${error.stack}`);

      // Last resort: direct capture
      try {
        this.logger.warn(
          `🚨 FALLBACK: Direct Puppeteer capture for ${cacheKey}`
        );
        return await this.captureDirectScreenshot(url, cacheKey);
      } catch (fallbackError) {
        this.logger.error(
          `💥 CRITICAL: All screenshot methods failed for ${cacheKey}`
        );
        this.logger.error(`Fallback error: ${fallbackError.message}`);
        throw new Error(
          `Screenshot completely failed for ${cacheKey}: ${fallbackError.message}`
        );
      }
    }
  }

  /**
   * 🚨 FALLBACK METHOD: Direct Puppeteer screenshot when queue fails
   * Bypasses queue, cache, and goes straight to browser
   */
  private async captureDirectScreenshot(
    url: string,
    cacheKey: string
  ): Promise<string> {
    this.logger.log(`🔧 Direct screenshot capture started: ${cacheKey}`);

    const screenshotsDir = join(process.cwd(), "screenshots");
    await mkdir(screenshotsDir, { recursive: true });

    const sanitizedKey = cacheKey
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

    const filename = `FALLBACK_${sanitizedKey}-${Date.now()}.jpeg`;
    const filepath = join(screenshotsDir, filename);

    let page: any = null;

    try {
      // Get fresh page
      page = await this.browserService.getPage(`fallback_${cacheKey}`);

      this.logger.log(`📄 Navigating to: ${url}`);

      // Navigate with timeout
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Hide footers
      await page.evaluate(() => {
        const selectors = [
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
            (el) => ((el as HTMLElement).style.display = "none")
          );
        });
      });

      this.logger.log(`📸 Capturing screenshot...`);

      await page.screenshot({
        path: filepath as `${string}.jpeg`,
        type: "jpeg",
        quality: 100,
        fullPage: true,
        timeout: 45000,
      });

      this.logger.log(`💾 Screenshot saved locally: ${filename}`);

      // Generate local URL path (served via ServeStaticModule)
      const localUrl = `/screenshots/${filename}`;

      // Save to cache for next time
      try {
        await this.cacheService.saveScreenshotByKey(cacheKey, localUrl);
        this.logger.log(`✅ Saved to cache: ${cacheKey}`);
      } catch (cacheError) {
        this.logger.warn(`⚠️ Could not save to cache: ${cacheError.message}`);
      }

      // Keep local file (no cleanup - served via ServeStaticModule)

      // Cleanup page
      try {
        await this.browserService.closePage(`fallback_${cacheKey}`);
      } catch (closeError) {
        this.logger.warn(`⚠️ Could not close page: ${closeError.message}`);
      }

      this.logger.log(`✅ Direct screenshot SUCCESS: ${localUrl}`);

      return localUrl;
    } catch (error) {
      this.logger.error(`💥 Direct screenshot FAILED: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);

      // Cleanup on error
      if (page) {
        try {
          await this.browserService.closePage(`fallback_${cacheKey}`);
        } catch (e) {
          // ignore
        }
      }

      throw error;
    }
  }

  async forceRefresh(url: string, cacheKey: string): Promise<string> {
    return this.getOrCreateScreenshot(url, cacheKey, true);
  }

  async getAllCachedScreenshots() {
    return this.cacheService.getAllCached();
  }

  async clearAllCache(): Promise<number> {
    return this.cacheService.clearAllCache();
  }
}
