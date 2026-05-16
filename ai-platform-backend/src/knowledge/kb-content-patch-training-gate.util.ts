import { normalizeKnowledgeTrainingStatus } from './knowledge-training-status.util';

/** When `queued`, block content PATCH if train is overdue, due now, or starting within this window (matches worker claim jitter). */
export const KB_CONTENT_PATCH_TRAIN_GATE_IMMINENT_MS = 10_000;

/**
 * Block manual KB content edits (document body/title, datasheet grid, Q&A, snippets, suggestion scope, etc.) while
 * that row’s embeddings train is **`processing`**, or while **`queued`** and `runAfter` is already due or within the
 * imminent window. Allows **`queued`** with a distant future `runAfter` (e.g. smart delay retrains).
 */
export function kbContentPatchBlockedByTrainingGate(
  status: string | undefined,
  runAfter: Date | null | undefined,
  nowMs: number,
  imminentMs: number,
): boolean {
  const st = normalizeKnowledgeTrainingStatus(String(status ?? ''));
  if (st === 'processing') return true;
  if (st !== 'queued') return false;
  if (runAfter == null) return true;
  const t = runAfter instanceof Date && !isNaN(runAfter.getTime()) ? runAfter.getTime() : null;
  if (t == null) return true;
  if (t <= nowMs) return true;
  return t - nowMs <= imminentMs;
}
