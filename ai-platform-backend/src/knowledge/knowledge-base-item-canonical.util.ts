/**
 * Canonical reads for {@link KnowledgeBaseItem} (`knowledge_base_items`).
 */

/** Persisted ingest/train codes surfaced on `KnowledgeBaseItem.trainingError` → customer-safe copy */
const KNOWN_TRAINING_ERROR_CUSTOMER_MESSAGE: Record<string, string> = {
  stale_document_text:
    'This document changed while training was running. Wait for uploads to finish, then use Retry.',
  stale_document_text_loop:
    'Training stopped because this document kept changing while we were training it. Pause edits briefly, then use Retry.',
};

/** Trimmed failure message when present. */
export function kbTrainingFailureMessage(row: {
  trainingError?: string | null;
}): string | null {
  const t = typeof row.trainingError === 'string' ? row.trainingError.trim() : '';
  if (!t) return null;
  return KNOWN_TRAINING_ERROR_CUSTOMER_MESSAGE[t] ?? t;
}

/** Successful train completion timestamp, if any. */
export function kbLastSuccessfulTrainInstant(row: {
  lastTrainedAt?: Date | null;
}): Date | undefined {
  const lt = row.lastTrainedAt;
  const ltOk = lt instanceof Date && !Number.isNaN(lt.getTime());
  return ltOk ? lt : undefined;
}

export function kbHasHadSuccessfulTrain(row: { lastTrainedAt?: Date | null }): boolean {
  return kbLastSuccessfulTrainInstant(row) !== undefined;
}
