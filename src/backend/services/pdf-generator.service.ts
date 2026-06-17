/**
 * PDF Generator Service
 * Converts HTML resume to PDF with ATS-safe formatting
 */

import puppeteer from 'puppeteer';

export class PDFGenerator {
  private browser: puppeteer.Browser | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      try {
        console.log('[PDFGenerator] Launching browser...');
        // Try to use system Chrome first, fall back to bundled Chromium
        const launchOptions = {
          headless: 'new' as const,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        };

        // On macOS, try to use system Chrome
        if (process.platform === 'darwin') {
          launchOptions.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        }

        this.browser = await Promise.race([
          puppeteer.launch(launchOptions),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Browser launch timeout after 15 seconds')),
              15000
            )
          ),
        ]);
        console.log('[PDFGenerator] Browser launched successfully');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[PDFGenerator] Failed to launch browser:', errorMsg);
        this.browser = null;
        throw new Error(`Browser launch failed: ${errorMsg}`);
      }
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Convert HTML resume to PDF buffer
   */
  async htmlToPdf(html: string, filename?: string): Promise<Buffer> {
    let page: puppeteer.Page | null = null;

    try {
      console.log('[PDFGenerator] Initializing...');
      await this.initialize();

      if (!this.browser) {
        throw new Error('Browser initialization failed');
      }

      console.log('[PDFGenerator] Creating page...');
      page = await this.browser.newPage();

      console.log('[PDFGenerator] Setting content...');
      try {
        await Promise.race([
          page.setContent(html, {
            waitUntil: 'domcontentloaded',
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Content load timeout')), 10000)
          ),
        ]);
      } catch (err) {
        console.warn('[PDFGenerator] Content load warning:', err);
        // Try again with simpler approach
        await page.setContent(html);
      }

      console.log('[PDFGenerator] Generating PDF...');
      // PDF options for letter-size, ATS-safe output
      const pdfBuffer = await page.pdf({
        format: 'letter',
        margin: {
          top: '0.6in',
          right: '0.6in',
          bottom: '0.6in',
          left: '0.6in',
        },
        printBackground: true,
        preferCSSPageSize: true,
      });

      console.log('[PDFGenerator] PDF generated successfully');
      return pdfBuffer;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[PDFGenerator] Error:', errorMsg);
      throw new Error(`PDF generation failed: ${errorMsg}`);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (err) {
          console.error('[PDFGenerator] Error closing page:', err);
        }
      }
    }
  }
}

export const pdfGenerator = new PDFGenerator();
