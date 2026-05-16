/**
 * Scopes {@link TrainJob} processes **all** `queued` rows in a scope together (see
 * {@link KnowledgeTrainingJobService.markScopeQueuedToProcessing}). The job must not be
 * claimed until every queued row is past its own `runAfter`, so we use the **latest**
 * `runAfter` among those rows (not the earliest).
 */
export function latestQueuedKnowledgeItemRunAfter(
  rows: Array<{ runAfter?: Date | null | undefined }>,
  now: Date,
): Date | null {
  if (rows.length === 0) return null;
  const nowMs = now.getTime();
  let maxT = -Infinity;
  for (const it of rows) {
    const ra = it.runAfter;
    if (ra instanceof Date && !isNaN(ra.getTime())) {
      maxT = Math.max(maxT, ra.getTime());
    } else {
      maxT = Math.max(maxT, nowMs);
    }
  }
  return new Date(maxT);
}
