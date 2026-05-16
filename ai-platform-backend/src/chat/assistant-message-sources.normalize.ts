import { Types } from 'mongoose';
import type { MessageSource } from '../models/message.schema';

/** Max sources persisted per assistant message (prompt + DB safety). */
export const ASSISTANT_MESSAGE_SOURCES_MAX = 10;

const MAX_CHUNK_ID = 128;
const MAX_DOC_ID = 128;
const MAX_TITLE = 500;
const MAX_URL = 2048;
const MAX_PREVIEW = 500;

type SchemaSourceType = NonNullable<MessageSource['sourceType']>;

const SCHEMA_SOURCE_TYPES = new Set<string>([
  'document',
  'faq',
  'note',
  'datasheet',
  'suggestion',
  'website',
  'manual_text',
  'unknown',
]);

function trimSlice(s: string | undefined, max: number): string | undefined {
  const t = String(s ?? '').trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

/** Map unified RAG / KnowledgeSourceType strings to Message schema enum. */
export function mapRagSourceTypeToMessageSourceType(raw: string | undefined): SchemaSourceType | undefined {
  if (raw == null || typeof raw !== 'string') return undefined;
  const t = raw.trim().toLowerCase();
  if (SCHEMA_SOURCE_TYPES.has(t)) return t as SchemaSourceType;
  if (t === 'url' || t === 'html') return 'website';
  if (t === 'table') return 'datasheet';
  return undefined;
}

/**
 * Infer schema sourceType from free-text hints (file names, labels) when explicit type missing.
 */
export function inferSourceTypeFromHints(...hints: (string | undefined)[]): SchemaSourceType {
  const blob = hints
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .join(' ')
    .toLowerCase();
  if (!blob) return 'unknown';
  if (/\bfaq\b|f\.a\.q|q&a|question\s*:/.test(blob)) return 'faq';
  if (/\bnote\b|knowledge\s*description|internal\s*note/.test(blob)) return 'note';
  if (/\btable\b|datasheet|\bcsv\b|\bxlsx\b|\bxls\b/.test(blob)) return 'datasheet';
  if (/\bsuggestion\b|suggested\s*question|trainable\s*chip/.test(blob)) return 'suggestion';
  if (/\bwebsite\b|\burl\b|\bpage\b|https?:\/\//.test(blob)) return 'website';
  if (/\bmanual\b|manual_text/.test(blob)) return 'manual_text';
  if (/\bdocument\b|\bdoc\b|\.pdf\b|\.docx?\b|file\s*upload/.test(blob)) return 'document';
  return 'unknown';
}

/** Parse a single numeric field; preserves 0; rejects NaN/Infinity. */
function parseFiniteNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return undefined;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Pick retrieval / match score for persistence into Message.sources[].score.
 * Unified RAG passes EnrichedChunk-shaped rows with `combinedScore`, not `score`.
 * Priority: explicit score → combinedScore → common aliases → component scores.
 * Does not invent values; does not coerce invalid strings.
 */
export function extractRetrievalScoreForMessageSource(o: Record<string, unknown>): number | undefined {
  const explicit = parseFiniteNumber(o.score);
  if (explicit !== undefined) return explicit;

  const combined = parseFiniteNumber(o.combinedScore);
  if (combined !== undefined) return combined;

  const alt = parseFiniteNumber(
    o.similarityScore ?? o.similarity ?? o.vectorScore ?? o.rerankScore ?? o.relevanceScore,
  );
  if (alt !== undefined) return alt;

  const sem = parseFiniteNumber(o.semanticScore);
  if (sem !== undefined) return sem;

  const lex = parseFiniteNumber(o.lexicalScore);
  if (lex !== undefined) return lex;

  return undefined;
}

function parseKnowledgeBaseItemId(v: unknown): Types.ObjectId | undefined {
  if (v instanceof Types.ObjectId) return v;
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s || !Types.ObjectId.isValid(s)) return undefined;
  try {
    return new Types.ObjectId(s);
  } catch {
    return undefined;
  }
}

function rowHasUsefulData(row: MessageSource): boolean {
  return Boolean(
    row.chunkId?.trim() ||
      row.docId?.trim() ||
      row.preview?.trim() ||
      row.sourceTitle?.trim() ||
      row.docTitle?.trim() ||
      row.knowledgeBaseItemId,
  );
}

/**
 * Normalize RAG / API source rows for assistant `Message.sources` persistence.
 * Preserves legacy fields; adds sourceType, knowledgeBaseItemId, sourceTitle, sourceUrl, usedAt when possible.
 */
export function normalizeAssistantMessageSourcesForPersistence(input: {
  sources?: unknown[] | null;
  assistantMessageCreatedAt?: Date;
}): MessageSource[] {
  const usedAtDefault = input.assistantMessageCreatedAt ?? new Date();
  const raw = Array.isArray(input.sources) ? input.sources : [];
  const out: MessageSource[] = [];

  for (const item of raw) {
    if (out.length >= ASSISTANT_MESSAGE_SOURCES_MAX) break;
    if (item == null || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;

    const chunkId = trimSlice(
      typeof o.chunkId === 'string' ? o.chunkId : typeof o.chunkId === 'number' ? String(o.chunkId) : undefined,
      MAX_CHUNK_ID,
    );
    const docId = trimSlice(
      typeof o.docId === 'string'
        ? o.docId
        : typeof o.documentId === 'string'
          ? o.documentId
          : undefined,
      MAX_DOC_ID,
    );

    const titleRaw =
      (typeof o.title === 'string' && o.title) ||
      (typeof o.docTitle === 'string' && o.docTitle) ||
      (typeof o.sourceTitle === 'string' && o.sourceTitle) ||
      (typeof o.name === 'string' && o.name) ||
      '';
    const docTitle = trimSlice(typeof o.docTitle === 'string' ? o.docTitle : titleRaw, MAX_TITLE);
    const sourceTitle = trimSlice(
      typeof o.sourceTitle === 'string' ? o.sourceTitle : titleRaw || docTitle,
      MAX_TITLE,
    );

    const textPreview =
      typeof o.preview === 'string'
        ? o.preview
        : typeof o.text === 'string'
          ? o.text
          : '';
    const preview = trimSlice(textPreview, MAX_PREVIEW);

    const score = extractRetrievalScoreForMessageSource(o);

    const urlRaw =
      (typeof o.sourceUrl === 'string' && o.sourceUrl) ||
      (typeof o.url === 'string' && o.url) ||
      '';
    const sourceUrl = trimSlice(urlRaw, MAX_URL);

    const explicitType =
      typeof o.sourceType === 'string'
        ? mapRagSourceTypeToMessageSourceType(o.sourceType)
        : undefined;
    const sourceType: SchemaSourceType =
      explicitType ?? inferSourceTypeFromHints(titleRaw, docTitle, preview, chunkId, docId);

    const kbRaw = o.knowledgeBaseItemId ?? o.knowledgeBaseItemID;
    const fromDoc = docId && Types.ObjectId.isValid(docId) ? docId : undefined;
    const knowledgeBaseItemId =
      parseKnowledgeBaseItemId(kbRaw) ?? parseKnowledgeBaseItemId(fromDoc);

    const usedAt =
      o.usedAt instanceof Date && !Number.isNaN(o.usedAt.getTime())
        ? o.usedAt
        : typeof o.usedAt === 'string'
          ? (() => {
              const d = new Date(o.usedAt);
              return Number.isNaN(d.getTime()) ? usedAtDefault : d;
            })()
          : usedAtDefault;

    const row: MessageSource = {
      ...(chunkId ? { chunkId } : {}),
      ...(docId ? { docId } : {}),
      ...(docTitle ? { docTitle } : {}),
      ...(preview ? { preview } : {}),
      ...(score !== undefined ? { score } : {}),
      sourceType,
      ...(knowledgeBaseItemId ? { knowledgeBaseItemId } : {}),
      ...(sourceTitle ? { sourceTitle } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      usedAt,
    };

    if (!rowHasUsefulData(row)) continue;
    out.push(row);
  }

  return out;
}
