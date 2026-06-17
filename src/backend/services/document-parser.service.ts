import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

// pdf-parse is CommonJS
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule && typeof pdfParseModule === 'function'
  ? pdfParseModule
  : pdfParseModule.default;

export class DocumentParserService {
  async parseFile(filePath: string, filename: string): Promise<string> {
    const ext = path.extname(filename).toLowerCase();

    switch (ext) {
      case '.pdf':
        return this.parsePdf(filePath);
      case '.docx':
        return this.parseDocx(filePath);
      case '.txt':
        return this.parseText(filePath);
      case '.md':
        return this.parseMarkdown(filePath);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  private async parsePdf(filePath: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    try {
      // Try to use pdf-parse
      if (typeof pdfParse === 'function') {
        const data = await pdfParse(fileBuffer);
        return data.text || '';
      }
    } catch (error) {
      console.warn('PDF parsing failed, extracting raw text instead');
    }

    // Fallback: extract raw text from PDF
    return fileBuffer.toString('utf-8', 0, Math.min(10000, fileBuffer.length));
  }

  private async parseDocx(filePath: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value || '';
    } catch (error) {
      console.warn('DOCX parsing failed, extracting raw text instead');
      // Fallback: extract raw text
      return fileBuffer.toString('utf-8', 0, Math.min(10000, fileBuffer.length));
    }
  }

  private async parseText(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  private async parseMarkdown(filePath: string): Promise<string> {
    // Markdown is plain text, just read it
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }
}

export const documentParser = new DocumentParserService();
