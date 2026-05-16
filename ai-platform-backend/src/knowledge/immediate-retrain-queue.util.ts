/**
 * `$or` branches for bulk Retrain Agent / train-now KB updates (`applyTrainNow`).
 * Does not touch `processing` (filtered at query top level via `$ne`).
 */
export function actionableRetrainOrBranches(
  includeFailed: boolean,
  includeReadyWhenBulkForceRetrain: boolean,
  now: Date,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [{ status: 'pending' }];
  if (includeFailed) rows.push({ status: 'failed' });
  rows.push({ status: 'queued', runAfter: { $gt: now } });
  if (includeReadyWhenBulkForceRetrain) rows.push({ status: 'ready' });
  return rows;
}
