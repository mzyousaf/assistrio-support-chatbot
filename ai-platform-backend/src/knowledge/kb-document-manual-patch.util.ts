import {
  documentKbContentFingerprint,
  normalizeKbDocumentBodyForHash,
  normalizeKbDocumentTitleForRow,
} from './knowledge-content-hash.util';

type KbLeanForManualPatch = {
  contentHash?: string;
  active?: boolean;
} | null;

/**
 * True when a customer document PATCH would not change semantic knowledge (title+body fingerprint)
 * or inclusion; used to skip job churn and status regression on no-op Save.
 */
export function kbDocumentManualPatchIsNoop(
  kb: KbLeanForManualPatch,
  nextTitle: string,
  nextText: string,
  nextActive: boolean,
): boolean {
  if (!kb) return false;
  const titleNorm = normalizeKbDocumentTitleForRow(nextTitle);
  const bodyNorm = normalizeKbDocumentBodyForHash(nextText);
  const fp = documentKbContentFingerprint(titleNorm, bodyNorm);
  const sameFingerprint = String(kb.contentHash ?? '').trim() === fp;
  const kbActive = kb.active !== false;
  const sameActive = kbActive === nextActive;
  return sameFingerprint && sameActive;
}
