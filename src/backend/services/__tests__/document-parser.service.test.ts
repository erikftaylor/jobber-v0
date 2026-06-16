import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DocumentParserService } from '../document-parser.service';

describe('DocumentParserService', () => {
  const parser = new DocumentParserService();
  const testDir = path.join(process.cwd(), 'test-fixtures');
  const txtFile = path.join(testDir, 'test.txt');
  const docxFile = path.join(testDir, 'test.docx');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a simple text file for testing
    fs.writeFileSync(txtFile, 'John Doe\nSenior Software Engineer\n\nSkills: TypeScript, React, Node.js');
  });

  afterAll(() => {
    if (fs.existsSync(txtFile)) {
      fs.unlinkSync(txtFile);
    }
    if (fs.existsSync(docxFile)) {
      fs.unlinkSync(docxFile);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
  });

  it('should parse a text file', async () => {
    const text = await parser.parseFile(txtFile, 'test.txt');
    expect(text).toContain('John Doe');
    expect(text).toContain('Senior Software Engineer');
    expect(text).toContain('TypeScript');
  });

  it('should throw error for unsupported file types', async () => {
    const unsupportedFile = path.join(testDir, 'test.xyz');
    fs.writeFileSync(unsupportedFile, 'test content');

    try {
      await parser.parseFile(unsupportedFile, 'test.xyz');
      expect.fail('Should have thrown error');
    } catch (error) {
      expect((error as Error).message).toContain('Unsupported file type');
    } finally {
      fs.unlinkSync(unsupportedFile);
    }
  });

  it('should handle case-insensitive file extensions', async () => {
    const text = await parser.parseFile(txtFile, 'test.TXT');
    expect(text).toContain('John Doe');
  });
});
