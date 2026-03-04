import { readFile } from "fs/promises";

import { Chunk } from "@/models/Chunk";
import { embedText } from "@/lib/rag";

const MAX_EXTRACTED_CHARS = 200_000;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const MIN_CHUNK_LENGTH = 100;
const MAX_CHUNKS = 40;
const MAX_EMBED_TOTAL_CHARS = 80_000;

export function getFileExtension(fileName: string): string {
  const normalized = fileName.trim();
  const lastDotIndex = normalized.lastIndexOf(".");
  if (lastDotIndex < 0) return "";
  return normalized.slice(lastDotIndex + 1).toLowerCase();
}

export async function readFileAsBuffer(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractTextFromUpload(params: {
  filePath: string;
  fileName: string;
  fileType?: string;
}): Promise<{ text: string; extracted: boolean; reason?: string }> {
  const extension = getFileExtension(params.fileName);
  let rawText = "";
  let reason: string | undefined;

  try {
    if (extension === "txt") {
      rawText = await readFile(params.filePath, "utf8");
    } else if (extension === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const buffer = await readFileAsBuffer(params.filePath);
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      await parser.destroy();
      rawText = data.text || "";
    } else if (extension === "docx") {
      const mammoth = await import("mammoth");
      const buffer = await readFileAsBuffer(params.filePath);
      const data = await mammoth.extractRawText({ buffer });
      rawText = data.value || "";
    } else if (extension === "doc") {
      const { default: WordExtractor } = await import("word-extractor");
      const extractor = new WordExtractor();
      const document = await extractor.extract(params.filePath);
      rawText = document.getBody() || "";
    } else {
      return { text: "", extracted: false, reason: "unsupported_file_type" };
    }
  } catch {
    if (extension === "doc") {
      return { text: "", extracted: false, reason: "doc_extract_unavailable" };
    }
    return { text: "", extracted: false, reason: "extraction_failed" };
  }

  const normalized = normalizeText(rawText);
  if (!normalized) {
    return { text: "", extracted: false, reason: "empty" };
  }

  if (normalized.length > MAX_EXTRACTED_CHARS) {
    reason = "truncated";
    return {
      text: normalized.slice(0, MAX_EXTRACTED_CHARS),
      extracted: true,
      reason,
    };
  }

  return { text: normalized, extracted: true, reason };
}

export function chunkText(text: string): string[] {
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

export async function embedAndStoreChunks(params: {
  botId: string;
  documentId: string;
  chunks: string[];
}): Promise<{ embedded: boolean; chunkCount: number; reason?: string }> {
  const limitedChunks = params.chunks.slice(0, MAX_CHUNKS);
  const totalCharacters = limitedChunks.reduce((total, chunk) => total + chunk.length, 0);

  if (!limitedChunks.length) {
    await Chunk.deleteMany({ documentId: params.documentId });
    return { embedded: false, chunkCount: 0, reason: "no_chunks" };
  }

  if (totalCharacters > MAX_EMBED_TOTAL_CHARS) {
    return {
      embedded: false,
      chunkCount: 0,
      reason: "too_large_for_auto_embedding",
    };
  }

  await Chunk.deleteMany({ documentId: params.documentId });

  let insertedCount = 0;
  for (const chunkTextValue of limitedChunks) {
    const embedding = await embedText(chunkTextValue);
    if (!embedding.length) continue;

    await Chunk.create({
      botId: params.botId,
      documentId: params.documentId,
      text: chunkTextValue,
      embedding,
    });
    insertedCount += 1;
  }

  return { embedded: insertedCount > 0, chunkCount: insertedCount };
}
