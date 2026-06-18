/**
 * PDF Generator Service
 * Converts HTML resume to PDF using pdfkit (no browser required)
 */

import PDFDocument from 'pdfkit';

export class PDFGenerator {
  /**
   * Convert HTML resume to PDF buffer
   * Uses pdfkit for pure JavaScript PDF generation (no browser needed)
   */
  async htmlToPdf(html: string, filename?: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[PDFGenerator] Starting PDF generation with pdfkit');

        const doc = new PDFDocument({
          size: 'Letter',
          margins: {
            top: 43, // 0.6in in points
            right: 43,
            bottom: 43,
            left: 43,
          },
        });

        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        doc.on('end', () => {
          const pdf = Buffer.concat(chunks);
          console.log('[PDFGenerator] PDF generated:', pdf.length, 'bytes');
          resolve(pdf);
        });

        doc.on('error', (err) => {
          console.error('[PDFGenerator] PDF error:', err);
          reject(err);
        });

        // Extract text from HTML and render to PDF
        const text = this.htmlToText(html);

        // Set font and render content
        doc.fontSize(10.5);
        doc.text(text, {
          align: 'left',
          lineGap: 5,
        });

        doc.end();
      } catch (err) {
        console.error('[PDFGenerator] Error:', err);
        reject(err);
      }
    });
  }

  /**
   * Convert HTML to plain text for PDF rendering
   */
  private htmlToText(html: string): string {
    // Remove script and style tags
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Convert HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');

    // Remove HTML tags but keep content
    text = text.replace(/<[^>]*>/g, '');

    // Clean up whitespace
    text = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n');

    // Decode HTML entities
    const textarea = { value: text } as any;
    try {
      const div = require('os').platform() === 'win32'
        ? { innerHTML: text, textContent: '' }
        : { innerHTML: text, textContent: '' };
      // Use simple regex replacements instead
      text = text
        .replace(/&#(\d+);/g, (_: string, code: string) => String.fromCharCode(Number(code)))
        .replace(/&#x([a-f\d]+);/gi, (_: string, code: string) => String.fromCharCode(Number(`0x${code}`)));
    } catch (e) {
      // Ignore HTML parsing errors
    }

    return text;
  }

  async initialize(): Promise<void> {
    // No-op - pdfkit doesn't require initialization
  }

  async close(): Promise<void> {
    // No-op - pdfkit doesn't require cleanup
  }
}

export const pdfGenerator = new PDFGenerator();
