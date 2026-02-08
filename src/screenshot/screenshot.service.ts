import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BrowserService } from "./browser.service";
import { join } from "path";
import { mkdir, unlink } from "fs/promises";

export interface ScreenshotResult {
  filePath: string;
}

@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);

  constructor(
    private configService: ConfigService,
    private browserService: BrowserService,
  ) { }

  async getScreenshot(url: string, cacheKey: string): Promise<ScreenshotResult> {
    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Screenshot attempt ${attempt}/${maxRetries} for ${url}`);
        const filePath = await this.captureScreenshot(url, cacheKey);
        if (attempt > 1) {
          this.logger.log(`✅ Screenshot succeeded on attempt ${attempt}`);
        }
        return { filePath };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Screenshot attempt ${attempt} failed: ${lastError.message}`);
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          this.logger.log(`Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    this.logger.error(`Screenshot failed after ${maxRetries} attempts: ${lastError.message}`);
    throw lastError;
  }

  private async captureScreenshot(
    url: string,
    cacheKey: string,
  ): Promise<string> {
    const screenshotsDir = join(process.cwd(), "screenshots");
    await mkdir(screenshotsDir, { recursive: true });

    const sanitizedKey = this.sanitizeFilename(cacheKey);
    const filename = `${sanitizedKey}-${Date.now()}.jpeg`;
    const filepath = join(screenshotsDir, filename);

    const page = await this.browserService.createPage();

    try {
      // Use domcontentloaded for faster loading on slow servers
      // This doesn't wait for all network requests to finish
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });

      // Wait for body to be sure page has some content
      await page.waitForSelector("body", { timeout: 15000 });
      
      // Give a bit more time for dynamic content
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Hide footer/contact section to crop it out
      await page.evaluate(() => {
        // Hide common footer/contact sections by selector
        const footerSelectors = [
          'footer',
          '.footer',
          '#footer',
          '.kontaktlar',
          '.contacts',
          '.contact-section',
        ];

        footerSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (el instanceof HTMLElement) {
              el.style.display = 'none';
            }
          });
        });

        // Also hide elements containing "Контакт" or "Kontakt" text
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          const text = el.textContent || '';
          if ((text.includes('Контакт') || text.includes('Kontakt')) &&
            text.length < 200 &&
            el.children.length < 10) {
            if (el instanceof HTMLElement) {
              el.style.display = 'none';
            }
          }
        });
      });

      await page.screenshot({
        path: filepath as `${string}.jpeg`,
        type: "jpeg",
        quality: 95,
        fullPage: true,
      });

      return filepath;
    } finally {
      await page.close().catch(() => { });
    }
  }

  async deleteLocalFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch (error) { }
  }

  private sanitizeFilename(key: string): string {
    return key.replace(/[\/\\:]/g, "_").replace(/[^a-zA-Z0-9_-]/g, "_");
  }
}