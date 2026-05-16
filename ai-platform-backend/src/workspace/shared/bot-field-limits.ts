import { DEFAULT_KB_FIELD_LIMITS } from '../../knowledge/knowledge-plan-limits';

/**
 * String limits for bot documents (profile, behavior, chat UI, lead capture).
 * Keep in sync with:
 * - `ai-platform-app-admin/src/lib/botFieldLimits.ts`
 * - `assistrio-customer-app/src/lib/botFieldLimits.ts`
 */
export const BOT_FIELD_MAX = {
  name: 120,
  shortDescription: 120,
  description: 2000,
  leadFieldLabel: 60,
  brandingMessage: 60,
  privacyText: 60,
  /** `personality.name` */
  personalityName: 120,
  personalityLanguage: 80,
  /** `personality.description` — behavior instructions */
  personalityDescription: 8000,
  /** `personality.systemPrompt` — assembled / stored prompt */
  personalitySystemPrompt: 100_000,
  thingsToAvoid: 4000,
  welcomeMessage: 2000,
  knowledgeDescription: 2000,
  /** Titled knowledge snippet (title) */
  knowledgeSnippetTitle: 200,
  /** Single snippet / cell text */
  knowledgeSnippetBody: 12_000,
  /** Q&A group title */
  knowledgeQaTitle: 200,
  /** One phrasing in a Q&A group */
  knowledgeQaQuestion: 2000,
  knowledgeQaAnswer: 12_000,
  /** Per spreadsheet table title */
  knowledgeDatasheetTitle: 200,
  knowledgeDatasheetCell: 2000,
  /** Original import filename stored with a datasheet (metadata only). */
  knowledgeDatasheetImportFileName: 255,
  /** Shown on the chip */
  exampleQuestion: 140,
  /** Per-suggestion scoped facts (first reply when chip has context; no full KB) */
  exampleQuestionContext: 4000,
  /** Single custom category or comma-joined (customer UI) */
  categoryText: 200,
  senderName: 120,
  scrollToBottomLabel: 120,
  /** Header menu quick link label */
  menuQuickLinkText: 120,
  /** Path or full URL for a quick link */
  menuQuickLinkRoute: 2000,
} as const;

export function clampStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

const UTF8_ENCODER = new TextEncoder();

/** UTF-8 byte length (Node/Web compatible). */
export function utf8ByteLength(s: string): number {
  return UTF8_ENCODER.encode(s).length;
}

/**
 * Truncates `s` to the longest prefix whose UTF-8 encoding fits in `maxBytes`
 * (safe on multi-byte boundaries).
 */
export function clampStrUtf8Bytes(s: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  if (utf8ByteLength(s) <= maxBytes) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (UTF8_ENCODER.encode(s.slice(0, mid)).length <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo);
}

/**
 * Fits all FAQ question strings into one combined UTF-8 byte budget (plan `faqQuestionMaxBytes`),
 * shrinking longest lines first until the total is within the cap.
 */
export function clampFaqQuestionsUtf8Combined(questions: string[], maxTotalBytes: number): string[] {
  if (maxTotalBytes <= 0) return questions.map(() => '');
  const qs = [...questions];
  while (true) {
    let total = 0;
    for (const q of qs) total += utf8ByteLength(q);
    if (total <= maxTotalBytes) return qs;
    let maxIdx = -1;
    let maxBytes = -1;
    for (let i = 0; i < qs.length; i++) {
      const b = utf8ByteLength(qs[i]!);
      if (b > maxBytes) {
        maxBytes = b;
        maxIdx = i;
      }
    }
    if (maxIdx < 0 || maxBytes <= 0) return qs;
    qs[maxIdx] = clampStrUtf8Bytes(qs[maxIdx]!, maxBytes - 1);
  }
}

/** Snippet / Q&A group / datasheet / document-edit titles — UTF-8 cap for UI parity with storage. */
export const KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES = 200;

/** Snippet bodies, Q&A answers, suggestion scoped context — UTF-8 cap (not document manual edit; see below). */
export const KNOWLEDGE_ITEM_BODY_MAX_UTF8_BYTES = 1024 * 1024;

/**
 * Manual document body when editing pasted text (customer Knowledge → Documents → Edit).
 * Matches upload ceiling intent (`DEFAULT_KB_FIELD_LIMITS.documentMaxUploadBytes` / `MAX_BOT_DOCUMENT_UPLOAD_BYTES`).
 */
export const KNOWLEDGE_DOCUMENT_MANUAL_BODY_MAX_UTF8_BYTES = 20 * 1024 * 1024;

/**
 * Max combined UTF-8 bytes for table `content` + `rawContent` on one knowledge item
 * (`buildTableEmbeddingText` + `JSON.stringify({ title, columns, rows })`).
 * Leaves headroom under MongoDB’s **16 MiB** maximum BSON document size for `tableMeta`, indexes, etc.
 */
export const KNOWLEDGE_TABLE_PERSIST_MAX_UTF8_BYTES = 14 * 1024 * 1024;

/**
 * Total UTF-8 size of a datasheet’s title plus all headers and cells after normalization
 * (single logical grid for validation during import / API).
 *
 * Must stay within reach of {@link KNOWLEDGE_TABLE_PERSIST_MAX_UTF8_BYTES}: each table row in Mongo holds
 * both embedding `content` and JSON `rawContent` duplicating the grid.
 *
 * Raw upload size may be larger (`MAX_DATASHEET_IMPORT_BYTES` in `bot-document-upload.constants.ts`) until parsed.
 */
export const KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES = 6 * 1024 * 1024;

/** Single Q&A phrasing line — UTF-8 cap (below full body limit). */
export const KNOWLEDGE_QA_QUESTION_MAX_UTF8_BYTES = 64 * 1024;

/** Max `leadCapture.fields` entries per bot (UI + API normalization). */
export const LEAD_CAPTURE_FIELDS_MAX = 10;

export const KNOWLEDGE_SNIPPETS_MAX = 100;
export const KNOWLEDGE_QA_MAX = 100;
/**
 * Max document **files per multipart upload request** (customer workspace + operator bot document batch).
 * Total documents per bot are capped separately by {@link KNOWLEDGE_DOCUMENTS_MAX}.
 */
export const KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX = 5;
/** Max knowledge document KB rows per bot (uploaded / URL docs — `sourceType: document`). */
export const KNOWLEDGE_DOCUMENTS_MAX = 50;
export const KNOWLEDGE_TABLES_MAX = 50;
export const KNOWLEDGE_TABLE_MAX_COLUMNS = 64;
export const KNOWLEDGE_TABLE_MAX_ROWS = 2000;
export const KNOWLEDGE_QA_QUESTIONS_MAX = 24;

/**
 * XLSX loads the full workbook in memory; reject larger files at preview/worker (CSV recommended for big grids).
 * Override with `TABLE_IMPORT_XLSX_MAX_BYTES` in code paths that read env.
 */
export const TABLE_IMPORT_XLSX_DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Max physical row span (height of `!ref` on the first sheet) for buffer-based datasheet parsing (`XLSX.read` +
 * `sheet_to_json`). Beyond this, require CSV import so the worker can stream. Does not replace the in-memory workbook
 * cap from {@link TABLE_IMPORT_XLSX_DEFAULT_MAX_BYTES} — both apply.
 */
export const TABLE_IMPORT_BUFFER_PARSE_MAX_PHYSICAL_ROWS_DEFAULT = 25_000;

/** Flush hook frequency while streaming CSV (data rows per callback; Mongo still persists once at end). */
export const TABLE_IMPORT_CSV_BATCH_ROWS_DEFAULT = 150;

/** Guard against pathological CSV rows stuck in the parser buffer. */
export const TABLE_IMPORT_CSV_MAX_BUFFER_UTF8_BYTES = 512 * 1024;

/** Minimum env override for {@link tableImportXlsxMaxBytesFromEnv} (1 MiB). */
const TABLE_IMPORT_XLSX_MAX_BYTES_ENV_MIN = 1024 * 1024;

/**
 * In-memory Excel parse cap (preview + worker). CSV imports use the streaming path and a separate source-byte cap.
 * Env: `TABLE_IMPORT_XLSX_MAX_BYTES` (bytes, ≥ 1 MiB).
 */
export function tableImportXlsxMaxBytesFromEnv(): number {
  const raw = process.env.TABLE_IMPORT_XLSX_MAX_BYTES;
  if (raw === undefined || String(raw).trim() === '') return TABLE_IMPORT_XLSX_DEFAULT_MAX_BYTES;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= TABLE_IMPORT_XLSX_MAX_BYTES_ENV_MIN ? n : TABLE_IMPORT_XLSX_DEFAULT_MAX_BYTES;
}

/**
 * Env: `TABLE_IMPORT_BUFFER_PARSE_MAX_PHYSICAL_ROWS` (integer, ≥ 1000). Caps first-sheet `!ref` height for buffer parse.
 */
export function tableImportBufferParseMaxPhysicalRowsFromEnv(): number {
  const raw = process.env.TABLE_IMPORT_BUFFER_PARSE_MAX_PHYSICAL_ROWS;
  if (raw === undefined || String(raw).trim() === '') return TABLE_IMPORT_BUFFER_PARSE_MAX_PHYSICAL_ROWS_DEFAULT;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1 || n > 2_000_000) return TABLE_IMPORT_BUFFER_PARSE_MAX_PHYSICAL_ROWS_DEFAULT;
  return n;
}

/**
 * Hard stop while streaming CSV from S3 (worker). Defaults to plan datasheet upload cap so a single import cannot
 * exceed what preview could accept. Env: `TABLE_IMPORT_CSV_MAX_SOURCE_BYTES` (bytes, ≥ 64 KiB).
 */
export function tableImportCsvMaxSourceBytesFromEnv(): number {
  const raw = process.env.TABLE_IMPORT_CSV_MAX_SOURCE_BYTES;
  const fallback = DEFAULT_KB_FIELD_LIMITS.datasheetMaxUploadBytes;
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 64 * 1024 ? n : fallback;
}
