import { Injectable, Logger } from "@nestjs/common";
import { CacheService } from "./cache.service";
import { ConfigService } from "@nestjs/config";
import { BrowserService } from "./browser.service";
import { join } from "path";
import { mkdir } from "fs/promises";

@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);

  constructor(
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

      // Directly capture screenshot (no queue)
      const screenshotUrl = await this.captureScreenshot(url, cacheKey);

      return screenshotUrl;
    } catch (error) {
      this.logger.error(`Failed to create screenshot: ${error.message}`);
      throw error;
    }
  }

  private async captureScreenshot(
    url: string,
    cacheKey: string
  ): Promise<string> {
    this.logger.log(`Processing screenshot: ${cacheKey}`);

    const screenshotsDir = join(process.cwd(), "screenshots");
    await mkdir(screenshotsDir, { recursive: true });

    // Sanitize filename
    const sanitizedKey = cacheKey
      .replace(/[\/\\:]/g, "_")
      .replace(/[А-Яа-яЁё]/g, (char) => {
        const translitMap: Record<string, string> = {
          А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "Yo",
          Ж: "Zh", З: "Z", И: "I", Й: "Y", К: "K", Л: "L", М: "M",
          Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T", У: "U",
          Ф: "F", Х: "Kh", Ц: "Ts", Ч: "Ch", Ш: "Sh", Щ: "Shch",
          Ъ: "", Ы: "Y", Ь: "", Э: "E", Ю: "Yu", Я: "Ya",
          а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
          ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
          н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
          ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
          ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
        };
        return translitMap[char] || char;
      })
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const filename = `${sanitizedKey}-${Date.now()}.jpeg`;
    const filepath = join(screenshotsDir, filename);

    let page: any = null;
    let retries = 2;
    let lastError: Error = null;

    while (retries >= 0) {
      try {
        await this.browserService.cleanupIdlePages(5);

        page = await this.browserService.getPage(cacheKey);

        this.logger.log(`🌐 Navigating to ${url}`);
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });

        this.logger.log(`⏳ Waiting for content...`);
        await page.waitForSelector("body", { timeout: 10000 });

        await page.evaluate(() => {
          const selectors = [
            "header", ".header", '[class*="header"]', '[id*="header"]',
            "nav", ".nav", ".navbar",
            "footer", ".footer", '[class*="footer"]', '[id*="footer"]',
            '[class*="contact"]', '[class*="bottom"]',
          ];
          selectors.forEach((selector) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el) => ((el as HTMLElement).style.display = "none"));
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

        const localUrl = `/screenshots/${filename}`;

        await this.cacheService.saveScreenshotByKey(cacheKey, localUrl);
        this.logger.log(`✅ Saved to cache: ${cacheKey}`);

        await this.browserService.closePage(cacheKey);
        this.browserService.incrementScreenshotCount();

        this.logger.log(`✓ Screenshot available at: ${localUrl}`);

        return localUrl;
      } catch (error) {
        lastError = error;
        retries--;
        this.logger.warn(`⚠️ Screenshot failed (${2 - retries}/3): ${error.message}`);

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

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    throw lastError || new Error("Failed to capture screenshot");
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
