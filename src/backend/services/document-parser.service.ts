import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

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
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  private async parsePdf(filePath: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(fileBuffer);
    return data.text;
  }

  private async parseDocx(filePath: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }

  private async parseText(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, 'utf-8');
  }
}

export const documentParser = new DocumentParserService();
