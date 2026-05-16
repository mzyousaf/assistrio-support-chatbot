import * as crypto from 'crypto';

/** Same algorithm as KnowledgeBaseItem `contentHash`: sha256 UTF-8, hex, first 32 chars. */
export function computeKnowledgeContentHash(input: string): string {
  return crypto.createHash('sha256').update(input || '', 'utf8').digest('hex').slice(0, 32);
}

/**
 * Normalizes embeddable document body text the same way as `KbService` file extraction (`normalizeText` there).
 * Keeps `content`, `contentHash`, chunking, and stale-guard fingerprints consistent across upload/extract/train.
 */
export function normalizeKbDocumentBodyForHash(body: string): string {
  return String(body ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Canonical stored title for document KB rows (trimmed display name; empty → `Document`). */
export function normalizeKbDocumentTitleForRow(title: unknown): string {
  const t = String(title ?? '').trim();
  return t || 'Document';
}

/**
 * Document KB fingerprint for `contentHash` and stale-guard checks: canonical title + `\n` + normalized body.
 * Must stay aligned with {@link documentIngestKbContentFingerprint}.
 */
export function documentKbContentFingerprint(title: string | undefined, body: string): string {
  const normTitle = normalizeKbDocumentTitleForRow(title);
  const normBody = normalizeKbDocumentBodyForHash(body);
  return computeKnowledgeContentHash(`${normTitle}\n${normBody}`);
}
