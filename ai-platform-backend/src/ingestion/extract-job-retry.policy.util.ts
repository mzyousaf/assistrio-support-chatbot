/**
 * Limits and backoff after {@link ExtractJob} extraction failures (`markJobFailed`).
 * Cron requeues failed jobs while `extractAutoRetryCycles < max`; at `>= max`, UI may offer manual retry.
 */
import {
  EXTRACT_JOB_MAX_AUTO_RETRIES,
  EXTRACT_JOB_RETRY_BACKOFF_BASE_MS,
  STUCK_RECOVERY_LIMIT_JOB_ERROR,
} from '../knowledge/knowledge-pipeline-retry.constants';

export function resolveExtractJobMaxAutoRetries(): number {
  return EXTRACT_JOB_MAX_AUTO_RETRIES;
}

/** Milliseconds between a failure and its next automatic cron re-queue attempt. Uses current `extractAutoRetryCycles`. */
export function extractFailureDeferRunAfterMs(forExtractAutoRetryCycles: number): number {
  const cappedBase = Math.min(900_000, Math.max(1_000, Math.floor(EXTRACT_JOB_RETRY_BACKOFF_BASE_MS)));
  const c = Math.max(0, Math.min(15, Number.isFinite(forExtractAutoRetryCycles) ? Math.floor(forExtractAutoRetryCycles) : 0));
  return Math.min(900_000, cappedBase * 2 ** c);
}

export function extractJobErrorIndicatesStuckRecoveryLimit(error?: string | null): boolean {
  return String(error ?? '').includes(STUCK_RECOVERY_LIMIT_JOB_ERROR);
}

export function isExtractManualRetrySuggested(params: {
  extractStatus?: string | null;
  extractAutoRetryCycles?: number | null | undefined;
  latestExtractError?: string | null;
}): boolean {
  if (params.extractStatus !== 'failed') return false;
  const c = typeof params.extractAutoRetryCycles === 'number' ? params.extractAutoRetryCycles : 0;
  if (c >= resolveExtractJobMaxAutoRetries()) return true;
  if (extractJobErrorIndicatesStuckRecoveryLimit(params.latestExtractError)) return true;
  return false;
}
