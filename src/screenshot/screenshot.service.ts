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
    try {
      const filePath = await this.captureScreenshot(url, cacheKey);
      return { filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Screenshot error: ${errorMessage}`);
      throw error;
    }
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
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 90000,
      });

      await page.waitForSelector("body", { timeout: 10000 });
      await new Promise((resolve) => setTimeout(resolve, 2000));

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