/**
 * PDF Generator Service
 * Converts HTML resume to PDF with ATS-safe formatting
 */

import puppeteer from 'puppeteer';

export class PDFGenerator {
  private browser: puppeteer.Browser | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
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
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();

    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

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

      return pdfBuffer;
    } finally {
      await page.close();
    }
  }
}

export const pdfGenerator = new PDFGenerator();
