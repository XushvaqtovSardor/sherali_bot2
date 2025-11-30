import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { BrowserService } from "./browser.service";
import { CacheService } from "./cache.service";
import { ConfigService } from "@nestjs/config";
import { join } from "path";
import { mkdir, unlink } from "fs/promises";
import { ScreenshotJobData } from "./screenshot.service";
import { FirebaseService } from "../firebase/firebase.service";

@Processor("screenshot", { concurrency: 7 })
export class ScreenshotProcessor extends WorkerHost {
  private readonly logger = new Logger(ScreenshotProcessor.name);

  constructor(
    private browserService: BrowserService,
    private cacheService: CacheService,
    private configService: ConfigService,
    private firebaseService: FirebaseService
  ) {
    super();
  }

  async process(job: Job<ScreenshotJobData>): Promise<string> {
    const { url, cacheKey } = job.data;

    this.logger.log(`Processing screenshot job: ${cacheKey}`);

    const screenshotsDir = join(process.cwd(), "screenshots");
    await mkdir(screenshotsDir, { recursive: true });

    // Sanitize filename: remove/replace invalid characters and transliterate Cyrillic
    const sanitizedKey = cacheKey
      .replace(/[\/\\:]/g, "_")
      .replace(/[А-Яа-яЁё]/g, (char) => {
        const translitMap: Record<string, string> = {
          'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
          'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
          'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
          'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
          'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
          'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
          'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
          'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
          'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return translitMap[char] || char;
      })
      .replace(/[^a-zA-Z0-9_-]/g, '_'); // Remove any remaining invalid characters

    const filename = `${sanitizedKey}-${Date.now()}.jpeg`;
    const filepath = join(screenshotsDir, filename);

    try {
      const page = await this.browserService.getPage(cacheKey);

      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      await new Promise((resolve) => setTimeout(resolve, 2000));

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

      await page.screenshot({
        path: filepath as `${string}.jpeg`,
        type: "jpeg",
        quality: 100,
        fullPage: true,
      });

      const firebaseUrl = await this.firebaseService.uploadScreenshot(
        filepath,
        filename
      );

      await this.cacheService.saveScreenshotByKey(cacheKey, firebaseUrl);

      try {
        await unlink(filepath);
      } catch (error) {
        this.logger.warn(`Failed to delete local file: ${filepath}`);
      }

      this.logger.log(`Screenshot saved to Firebase: ${filename}`);

      return firebaseUrl;
    } catch (error) {
      this.logger.error(`Failed to capture screenshot for ${cacheKey}`, error);
      throw error;
    }
  }
}
