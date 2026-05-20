import { isKbPlanLimitTrainingError } from '@/lib/knowledgeStorageLimits';
import { KNOWLEDGE_PIPELINE_STUCK_ESCALATION_AFTER_MS } from '@/lib/knowledgePipelineStuckEscalation';

/** Same threshold as {@link KNOWLEDGE_PIPELINE_STUCK_ESCALATION_AFTER_MS} (default 30 minutes). */
export const KNOWLEDGE_MANUAL_RETRY_STUCK_AFTER_MS = KNOWLEDGE_PIPELINE_STUCK_ESCALATION_AFTER_MS;

export type KnowledgeManualRetryStatusPick = {
  displayStatus?: string | null;
  displayMessage?: string | null;
  lastQueuedAt?: string | null;
  lastTrainingStartedAt?: string | null;
  updatedAt?: string | null;
  /** Row creation time — used for stuck “uploading” reset heuristic. */
  createdAt?: string | null;
  trainingError?: string | null;
  /** Mirrors backend: extraction auto-retries exhausted — prefer Retry extraction. */
  extractManualRetrySuggested?: boolean;
  /** Mirrors backend: training stuck-recovery cap hit — prefer Retry training. */
  trainingManualRetrySuggested?: boolean;
};

function parseIsoMs(iso: string | null | undefined): number {
  if (iso == null || !String(iso).trim()) return NaN;
  const t = Date.parse(String(iso));
  return Number.isFinite(t) ? t : NaN;
}

function isStuckProcessing(pick: KnowledgeManualRetryStatusPick, displayStatusLower: string): boolean {
  const now = Date.now();
  const thr = KNOWLEDGE_MANUAL_RETRY_STUCK_AFTER_MS;
  const ds = displayStatusLower.trim().toLowerCase();

  if (ds === 'extracting_text') {
    const t = parseIsoMs(pick.lastQueuedAt ?? pick.updatedAt);
    return Number.isFinite(t) && now - t > thr;
  }
  if (ds === 'importing_table' || ds === 'importing' || ds === 'import_queued') {
    const t = parseIsoMs(pick.updatedAt ?? pick.lastQueuedAt);
    return Number.isFinite(t) && now - t > thr;
  }
  if (ds === 'training' || ds === 'training_required') {
    const t = parseIsoMs(pick.lastTrainingStartedAt ?? pick.lastQueuedAt ?? pick.updatedAt);
    return Number.isFinite(t) && now - t > thr;
  }
  if (ds === 'uploading') {
    const t = parseIsoMs(pick.updatedAt ?? pick.createdAt);
    return Number.isFinite(t) && now - t > thr;
  }
  return false;
}

/**
 * Returns button label for customer manual retry, or `null` when no action should be shown.
 */
export function knowledgeManualRetryButtonLabel(
  pick: KnowledgeManualRetryStatusPick,
  options?: { isLabelOnlySuggestion?: boolean },
): string | null {
  if (options?.isLabelOnlySuggestion) return null;
  if (isKbPlanLimitTrainingError(pick.trainingError)) return null;
  const dsl = String(pick.displayStatus ?? '').trim().toLowerCase();
  if (dsl === 'out_of_storage') return null;
  if (!dsl) return null;

  if (pick.trainingManualRetrySuggested === true && (dsl === 'training_failed' || dsl === 'failed')) {
    return 'Retry training';
  }
  if (pick.extractManualRetrySuggested === true && dsl === 'extraction_failed') {
    const msg = String(pick.displayMessage ?? '').trim().toLowerCase();
    if (msg.includes('upload')) return null;
    return 'Retry extraction';
  }

  if (isStuckProcessing(pick, dsl)) {
    if (dsl === 'extracting_text') return 'Reset extraction';
    if (dsl === 'importing_table' || dsl === 'importing' || dsl === 'import_queued') return 'Reset import';
    if (dsl === 'training' || dsl === 'training_required') return 'Reset training';
  }

  if (dsl === 'extraction_failed') {
    const msg = String(pick.displayMessage ?? '').trim().toLowerCase();
    if (msg.includes('upload')) return null;
    return 'Retry extraction';
  }
  if (dsl === 'training_failed') return 'Retry training';
  if (dsl === 'import_failed') return 'Retry import';

  return null;
}
