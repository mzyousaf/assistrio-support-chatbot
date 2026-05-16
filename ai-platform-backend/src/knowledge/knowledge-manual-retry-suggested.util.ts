import { STUCK_RECOVERY_LIMIT_JOB_ERROR } from './knowledge-pipeline-retry.constants';

/** Stable machine-readable reason derived from raw stored `trainingError` (survives customer-facing humanization). */
export function resolveTrainingFailureCode(trainingError?: string | null): string | null {
  const t = String(trainingError ?? '').trim();
  if (!t) return null;
  if (t.includes(STUCK_RECOVERY_LIMIT_JOB_ERROR)) return STUCK_RECOVERY_LIMIT_JOB_ERROR;
  return null;
}

/** True when training failed after automatic stuck-recovery budget exhaustion (`trainingError` contains stuck limit code). */
export function isTrainingManualRetrySuggested(params: {
  knowledgeItemTrainingStatus?: string | null;
  trainingError?: string | null;
  /** Prefer when caller still has DB raw error; matches {@link resolveTrainingFailureCode}. */
  trainingFailureCode?: string | null;
}): boolean {
  if (String(params.knowledgeItemTrainingStatus ?? '').trim() !== 'failed') return false;
  if (params.trainingFailureCode === STUCK_RECOVERY_LIMIT_JOB_ERROR) return true;
  return String(params.trainingError ?? '').includes(STUCK_RECOVERY_LIMIT_JOB_ERROR);
}
