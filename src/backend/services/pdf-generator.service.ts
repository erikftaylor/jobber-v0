/**
 * PDF Generator Service
 * Converts HTML resume to PDF with ATS-safe formatting
 */

import puppeteer from 'puppeteer';

export class PDFGenerator {
  /**
   * Generate PDF without maintaining persistent browser
   * Creates and closes browser for each request to avoid resource issues
   */
  async generatePDF(html: string): Promise<Buffer> {
    let browser: puppeteer.Browser | null = null;
    let page: puppeteer.Page | null = null;

    try {
      console.log('[PDFGenerator] Launching browser for this request...');

      const launchOptions: puppeteer.PuppeteerLaunchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-extensions',
        ],
        timeout: 10000,
      };

      // On macOS, try to use system Chrome
      if (process.platform === 'darwin') {
        launchOptions.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      }

      browser = await puppeteer.launch(launchOptions);
      console.log('[PDFGenerator] Browser launched');

      page = await browser.newPage();
      console.log('[PDFGenerator] Page created');

      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      console.log('[PDFGenerator] Content loaded');

      const pdf = await page.pdf({
        format: 'letter',
        margin: {
          top: '0.6in',
          right: '0.6in',
          bottom: '0.6in',
          left: '0.6in',
        },
        printBackground: true,
      });

      console.log('[PDFGenerator] PDF generated:', pdf.length, 'bytes');
      return pdf;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.warn('[PDFGenerator] Error closing page:', e);
        }
      }
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.warn('[PDFGenerator] Error closing browser:', e);
        }
      }
    }
  }

  // Deprecated: keeping for backward compatibility
  private browser: puppeteer.Browser | null = null;

  async initialize(): Promise<void> {
    // No-op for backward compatibility
  }

  async close(): Promise<void> {
    // No-op for backward compatibility
  }

  /**
   * Convert HTML resume to PDF buffer
   * Uses generatePDF internally
   */
  async htmlToPdf(html: string, filename?: string): Promise<Buffer> {
    return this.generatePDF(html);
  }
}

export const pdfGenerator = new PDFGenerator();
