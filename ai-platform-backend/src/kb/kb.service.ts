import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { readFile } from 'fs/promises';
import { Model } from 'mongoose';
import { Chunk } from '../models';
import { RagService } from '../rag/rag.service';

const MAX_EXTRACTED_CHARS = 200_000;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const MIN_CHUNK_LENGTH = 100;
const MAX_CHUNKS = 40;
const MAX_EMBED_TOTAL_CHARS = 80_000;

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

@Injectable()
export class KbService {
  constructor(
    private readonly ragService: RagService,
    @InjectModel(Chunk.name) private readonly chunkModel: Model<Chunk>,
  ) {}

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

  chunkText(text: string): string[] {
    const normalized = normalizeText(text);
    if (!normalized) return [];

    const chunks: string[] = [];
    const step = CHUNK_SIZE - CHUNK_OVERLAP;

    let cursor = 0;
    while (cursor < normalized.length && chunks.length < MAX_CHUNKS) {
      const candidate = normalized.slice(cursor, cursor + CHUNK_SIZE).trim();
      if (candidate.length >= MIN_CHUNK_LENGTH) {
        chunks.push(candidate);
      }
      cursor += step;
    }

    return chunks;
  }

  async embedAndStoreChunks(params: {
    botId: string;
    documentId: string;
    chunks: string[];
    apiKeyOverride?: string;
  }): Promise<{ embedded: boolean; chunkCount: number; reason?: string }> {
    const limitedChunks = params.chunks.slice(0, MAX_CHUNKS);
    const totalCharacters = limitedChunks.reduce((total, chunk) => total + chunk.length, 0);

    if (!limitedChunks.length) {
      await this.chunkModel.deleteMany({ documentId: params.documentId });
      return { embedded: false, chunkCount: 0, reason: 'no_chunks' };
    }

    if (totalCharacters > MAX_EMBED_TOTAL_CHARS) {
      return {
        embedded: false,
        chunkCount: 0,
        reason: 'too_large_for_auto_embedding',
      };
    }

    await this.chunkModel.deleteMany({ documentId: params.documentId });

    let insertedCount = 0;
    for (const chunkTextValue of limitedChunks) {
      const embedding = await this.ragService.embedText(chunkTextValue, params.apiKeyOverride);
      if (!embedding.length) continue;

      await this.chunkModel.create({
        botId: params.botId,
        documentId: params.documentId,
        text: chunkTextValue,
        embedding,
      });
      insertedCount += 1;
    }

    return { embedded: insertedCount > 0, chunkCount: insertedCount };
  }
}
