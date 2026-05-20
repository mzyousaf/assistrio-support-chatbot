import type { AdminKnowledgeStatusItem } from '@/api/types';
import { normalizeKnowledgeTrainingStatus } from '@/lib/knowledgeTrainingStatus';

/** Training is starting within this window → block mutations (matches product “due soon”). */
export const KNOWLEDGE_TRAINING_GATE_DUE_SOON_MS = 10_000;

export type KnowledgeTrainingGateInput = {
  /** Primary KB lifecycle (`status` / merged training). */
  status?: string | null;
  runAfter?: string | null;
  isTraining?: boolean;
  isExtracting?: boolean;
  isImporting?: boolean;
};

export function findKnowledgeStatusItemById(
  items: AdminKnowledgeStatusItem[] | null | undefined,
  knowledgeItemId: string,
): AdminKnowledgeStatusItem | undefined {
  const id = knowledgeItemId.trim();
  if (!id || !items?.length) return undefined;
  return items.find((it) => String(it.id ?? '').trim() === id);
}

/**
 * Merge lightweight poll row + bot/list row for pre-flight training / pipeline checks.
 */
export function knowledgeTrainingGateInputFromPollRow(
  poll: Partial<AdminKnowledgeStatusItem> | null | undefined,
  row:
    | {
        trainingStatus?: string | null;
        status?: string | null;
        runAfter?: string | null;
        isTraining?: boolean;
        isExtracting?: boolean;
        isImporting?: boolean;
      }
    | null
    | undefined,
): KnowledgeTrainingGateInput {
  const p = poll ?? {};
  const r = row ?? {};
  return {
    status: (p.status ?? r.trainingStatus ?? r.status) as string | undefined,
    runAfter: p.runAfter ?? r.runAfter ?? null,
    isTraining: p.isTraining === true || r.isTraining === true ? true : undefined,
    isExtracting: p.isExtracting === true || r.isExtracting === true ? true : undefined,
    isImporting: p.isImporting === true || r.isImporting === true ? true : undefined,
  };
}

/**
 * @returns Human-readable block reason, or `null` when edit/delete may proceed.
 */
export function getKnowledgeTrainingMutationBlockReason(
  raw: KnowledgeTrainingGateInput | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!raw) return null;
  if (raw.isImporting === true) {
    return 'A datasheet import is still running. Wait for it to finish before changing this item.';
  }
  if (raw.isExtracting === true) {
    return 'Text extraction is still running. Wait for it to finish before changing this item.';
  }
  if (raw.isTraining === true) {
    return 'Training is in progress. Wait for it to finish before editing or deleting.';
  }
  const st = normalizeKnowledgeTrainingStatus(raw.status);
  if (st === 'processing') {
    return 'Training is in progress. Wait for it to finish before editing or deleting.';
  }
  if (st === 'queued') {
    return 'Training is queued or about to start. Wait a moment before editing or deleting.';
  }
  if (st !== 'ready' && st !== 'failed' && st !== 'out_of_storage') {
    const ra = raw.runAfter != null && String(raw.runAfter).trim();
    if (ra) {
      const t = Date.parse(ra);
      if (!Number.isNaN(t)) {
        const delta = t - nowMs;
        if (delta > 0 && delta <= KNOWLEDGE_TRAINING_GATE_DUE_SOON_MS) {
          return 'Training is scheduled to start within a few seconds. Please wait and try again.';
        }
      }
    }
  }
  return null;
}

export function resolveKnowledgeTrainingGateMessage(
  poll: Partial<AdminKnowledgeStatusItem> | null | undefined,
  row: Parameters<typeof knowledgeTrainingGateInputFromPollRow>[1],
  nowMs?: number,
): string | null {
  return getKnowledgeTrainingMutationBlockReason(knowledgeTrainingGateInputFromPollRow(poll, row), nowMs);
}

/** True when edit/delete should be blocked (same rules as {@link resolveKnowledgeTrainingGateMessage}). */
export function isKnowledgeTrainingMutationBlocked(
  poll: Partial<AdminKnowledgeStatusItem> | null | undefined,
  row: Parameters<typeof resolveKnowledgeTrainingGateMessage>[1],
  nowMs?: number,
): boolean {
  return resolveKnowledgeTrainingGateMessage(poll, row, nowMs) !== null;
}

/** List/detail rows: merge poll slice entry with `knowledgeItemId` and apply the training gate. */
export function isKnowledgeRowDeleteBlocked(
  statusItems: AdminKnowledgeStatusItem[] | null | undefined,
  knowledgeItemId: string | null | undefined,
  row: Parameters<typeof resolveKnowledgeTrainingGateMessage>[1],
  nowMs?: number,
): boolean {
  const poll = findKnowledgeStatusItemById(statusItems, knowledgeItemId?.trim() ?? '');
  return isKnowledgeTrainingMutationBlocked(poll, row, nowMs);
}
