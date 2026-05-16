import { documentKbContentFingerprint } from '../knowledge/knowledge-content-hash.util';

/** Same fingerprint as KnowledgeBaseItem document rows: canonical title + `\n` + normalized body ({@link normalizeKbDocumentBodyForHash}). */
export function documentIngestKbContentFingerprint(
  title: string | undefined,
  trimmedDocumentText: string,
): string {
  return documentKbContentFingerprint(title, trimmedDocumentText);
}

export type DocumentKbStaleSnapshot = {
  kbContentHash: string;
  kbLastContentUpdatedAt?: Date | null;
};

export type LeanDocForStale = {
  title?: string;
  text?: string;
  active?: boolean;
};

/**
 * Pre-flight before replacing document embeddings: missing row wins when deleted,
 * then KB/content drift vs snapshot (taken before embed batch) ⇒ skip write safely.
 * `KnowledgeBaseItem.active === false` only excludes replies/RAG — embeddings still persist.
 */
export function shouldSkipDocumentKnowledgeChunkWrite(
  latestDoc: LeanDocForStale | null,
  kbLatest: {
    active?: boolean;
    contentHash?: string;
    lastContentUpdatedAt?: Date | null;
  } | null,
  snapshot: DocumentKbStaleSnapshot,
): { skip: false } | { skip: true; reason: string; requeueLater: boolean; clearStuckProcessing: boolean } {
  if (!latestDoc) {
    return { skip: true, reason: 'document_deleted', requeueLater: false, clearStuckProcessing: false };
  }
  if (!kbLatest) {
    return { skip: true, reason: 'kb_item_missing', requeueLater: true, clearStuckProcessing: true };
  }
  const h1 = snapshot.kbContentHash ?? '';
  const h2 = kbLatest.contentHash ?? '';
  if (h1 !== h2) {
    return { skip: true, reason: 'stale_kb_content_hash', requeueLater: true, clearStuckProcessing: true };
  }
  const tSnap = snapshot.kbLastContentUpdatedAt ?? null;
  const tKb = kbLatest.lastContentUpdatedAt ?? null;
  if (!timesRoughlyEqualContentUpdate(tSnap, tKb)) {
    return {
      skip: true,
      reason: 'stale_kb_last_content_updated',
      requeueLater: true,
      clearStuckProcessing: true,
    };
  }
  const fpLatest = documentIngestKbContentFingerprint(
    latestDoc.title,
    String(latestDoc.text ?? '').trim(),
  );
  if (fpLatest !== snapshot.kbContentHash) {
    /**
     * Stored `contentHash` does not match title+body fingerprint while snapshot hash still matches the row —
     * train-only requeues cannot repair that (needs content save / upsert). Avoid infinite TrainJobs.
     */
    return { skip: true, reason: 'stale_document_text', requeueLater: false, clearStuckProcessing: false };
  }

  return { skip: false };
}

function timeMs(v: unknown): number | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : typeof v === 'string' ? new Date(v) : null;
  if (!d || !Number.isFinite(d.getTime())) return null;
  return d.getTime();
}

export function timesRoughlyEqualContentUpdate(snapshot: Date | null | undefined, latest: unknown): boolean {
  const tm = latest != null ? timeMs(latest) : null;
  const ts = snapshot ? timeMs(snapshot) : null;
  if (tm == null && ts == null) return true;
  if (tm == null || ts == null) return false;
  return tm === ts;
}
