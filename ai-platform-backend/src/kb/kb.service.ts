import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { readFile } from 'fs/promises';
import { Model, Types } from 'mongoose';
import { Chunk } from '../models';
import { RagService } from '../rag/rag.service';
import { chunkDocumentText } from './chunking.helper';

export interface DebugBotChunksResult {
  totalChunks: number;
  totalDocuments: number;
  sampleChunks: Array<{
    documentId: string;
    textPreview: string;
    embeddingLength: number;
  }>;
}

const MAX_EXTRACTED_CHARS = 200_000;
const MAX_CHUNKS = 50;
const MAX_EMBED_TOTAL_CHARS = 100_000;
/** Chunks per embedding API call (batch). Reduces round-trips vs one call per chunk. */
const EMBED_BATCH_SIZE = 25;

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

  /**
   * Chunk document text with section and FAQ awareness so later sections and tail content are retrievable.
   * Uses heading-based splitting, preserves section title in each chunk, and never drops short tail chunks.
   */
  chunkText(text: string): string[] {
    return chunkDocumentText(text);
  }

  /**
   * Debug helper: verify knowledge base chunks exist for a bot.
   * Queries chunks by botId, returns counts and sample chunks, and logs results to console.
   */
  async debugBotChunks(botId: string): Promise<DebugBotChunksResult> {
    if (!Types.ObjectId.isValid(botId)) {
      const result: DebugBotChunksResult = { totalChunks: 0, totalDocuments: 0, sampleChunks: [] };
      console.log('\n--- KB DEBUG ---\nBot: ' + botId + '\nInvalid botId\n');
      return result;
    }
    const botOid = new Types.ObjectId(botId);
    const [totalChunks, distinctDocs, sampleRows] = await Promise.all([
      this.chunkModel.countDocuments({ botId: botOid }),
      this.chunkModel.distinct('documentId', { botId: botOid }),
      this.chunkModel
        .find({ botId: botOid })
        .select('documentId text embedding')
        .limit(5)
        .lean(),
    ]);
    const totalDocuments = distinctDocs.length;
    const sampleChunks = sampleRows.map((row) => ({
      documentId: String((row as { documentId: Types.ObjectId }).documentId),
      textPreview: ((row as { text?: string }).text ?? '').slice(0, 200),
      embeddingLength: Array.isArray((row as { embedding?: number[] }).embedding)
        ? (row as { embedding: number[] }).embedding.length
        : 0,
    }));
    const result: DebugBotChunksResult = { totalChunks, totalDocuments, sampleChunks };

    console.log('\n--- KB DEBUG ---');
    console.log('Bot:', botId);
    console.log('Documents:', totalDocuments);
    console.log('Chunks:', totalChunks);
    sampleChunks.forEach((s, i) => {
      console.log('\nExample chunk', i + 1 + ':');
      console.log(JSON.stringify(s, null, 2));
    });
    console.log('---\n');

    return result;
  }

  async embedAndStoreChunks(params: {
    botId: string;
    documentId: string;
    chunks: string[];
    apiKeyOverride?: string;
  }): Promise<{ embedded: boolean; chunkCount: number; reason?: string }> {
    const limitedChunks = params.chunks.slice(0, MAX_CHUNKS);
    const totalCharacters = limitedChunks.reduce((total, chunk) => total + chunk.length, 0);

    console.log('[embedAndStoreChunks] Chunks created (input limited to MAX_CHUNKS):', limitedChunks.length);

    const docOid = new Types.ObjectId(params.documentId);
    const botOid = new Types.ObjectId(params.botId);

    if (!limitedChunks.length) {
      await this.chunkModel.deleteMany({ documentId: docOid, botId: botOid });
      return { embedded: false, chunkCount: 0, reason: 'no_chunks' };
    }

    if (totalCharacters > MAX_EMBED_TOTAL_CHARS) {
      return {
        embedded: false,
        chunkCount: 0,
        reason: 'too_large_for_auto_embedding',
      };
    }

    await this.chunkModel.deleteMany({ documentId: docOid, botId: botOid });
    await this.chunkModel.deleteMany({ documentId: docOid, botId: botOid });

    const toInsert: Array<{ botId: Types.ObjectId; documentId: Types.ObjectId; text: string; embedding: number[] }> = [];

    for (let i = 0; i < limitedChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = limitedChunks.slice(i, i + EMBED_BATCH_SIZE);
      const embeddings = await this.ragService.embedTexts(batch, params.apiKeyOverride);
      for (let j = 0; j < batch.length; j++) {
        const embedding = embeddings[j];
        if (embedding?.length) {
          toInsert.push({
            botId: botOid,
            documentId: docOid,
            text: batch[j],
            embedding,
          });
        }
      }
    }

    const insertedCount = toInsert.length;
    const allHaveEmbedding = toInsert.every((c) => Array.isArray(c.embedding) && c.embedding.length > 0);
    const minEmbedLen = toInsert.length ? Math.min(...toInsert.map((c) => c.embedding.length)) : 0;
    console.log(
      `[embedAndStoreChunks] documentId=${params.documentId} insertedChunkCount=${insertedCount} allHaveEmbedding=${allHaveEmbedding} minEmbeddingLength=${minEmbedLen}`,
    );

    if (toInsert.length > 0) {
      await this.chunkModel.insertMany(toInsert);
      console.log('[embedAndStoreChunks] Stored in DB:', toInsert.length, '(botId, documentId, text, embedding all set)');
    }

    return { embedded: toInsert.length > 0, chunkCount: toInsert.length };
  }
}
