import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { RagService } from '../rag/rag.service';
import { chunkDocumentText } from './chunking.helper';

const MAX_EXTRACTED_CHARS = 200_000;

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

@Injectable()
export class KbService {
  constructor(private readonly ragService: RagService) {}

  getFileExtension(fileName: string): string {
    const normalized = fileName.trim();
    const lastDotIndex = normalized.lastIndexOf('.');
    if (lastDotIndex < 0) return '';
    return normalized.slice(lastDotIndex + 1).toLowerCase();
  }

  async readFileAsBuffer(filePath: string): Promise<Buffer> {
    return readFile(filePath);
  }

  async extractTextFromUpload(params: {
    filePath: string;
    fileName: string;
    fileType?: string;
  }): Promise<{ text: string; extracted: boolean; reason?: string }> {
    const extension = this.getFileExtension(params.fileName);
    let rawText = '';
    let reason: string | undefined;

    try {
      if (extension === 'txt') {
        rawText = await readFile(params.filePath, 'utf8');
      } else if (extension === 'md' || extension === 'markdown' || params.fileType === 'text/markdown') {
        rawText = await readFile(params.filePath, 'utf8');
        if (rawText.startsWith('\uFEFF')) rawText = rawText.slice(1);
        rawText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      } else if (extension === 'pdf') {
        const { PDFParse } = await import('pdf-parse');
        const buffer = await this.readFileAsBuffer(params.filePath);
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        await parser.destroy();
        rawText = data.text || '';
      } else if (extension === 'docx') {
        const mammoth = await import('mammoth');
        const buffer = await this.readFileAsBuffer(params.filePath);
        const data = await mammoth.extractRawText({ buffer });
        rawText = data.value || '';
      } else if (extension === 'doc') {
        const WordExtractor = (await import('word-extractor')).default;
        const extractor = new WordExtractor();
        const document = await extractor.extract(params.filePath);
        rawText = document.getBody() || '';
      } else {
        return { text: '', extracted: false, reason: 'unsupported_file_type' };
      }
    } catch {
      if (extension === 'doc') {
        return { text: '', extracted: false, reason: 'doc_extract_unavailable' };
      }
      return { text: '', extracted: false, reason: 'extraction_failed' };
    }

    const normalized = normalizeText(rawText);
    if (!normalized) {
      return { text: '', extracted: false, reason: 'empty' };
    }

    if (normalized.length > MAX_EXTRACTED_CHARS) {
      reason = 'truncated';
      return {
        text: normalized.slice(0, MAX_EXTRACTED_CHARS),
        extracted: true,
        reason,
      };
    }

    return { text: normalized, extracted: true, reason };
  }

  /**
   * Chunk document text with section and FAQ awareness so later sections and tail content are retrievable.
   * Uses heading-based splitting, preserves section title in each chunk, and never drops short tail chunks.
   */
  chunkText(text: string): string[] {
    return chunkDocumentText(text);
  }
}
