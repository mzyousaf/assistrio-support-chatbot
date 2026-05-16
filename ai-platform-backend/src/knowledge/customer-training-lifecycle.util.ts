import { isScheduledRunDue } from './merge-training-scopes.util';

/**
 * Knowledge items the customer should treat as "Needs training" for counts + modal:
 * pending, failed, and queued with runAfter in the future (scheduled for later).
 */
export function isKnowledgeItemActionNeeded(
  status: string,
  runAfter: Date | null | undefined,
  now: Date,
): boolean {
  if (status === 'pending' || status === 'failed') return true;
  if (status === 'queued' && runAfter != null && runAfter.getTime() > now.getTime()) return true;
  return false;
}

/**
 * Items currently in the Training pipeline: processing, or queued and due (missing / null / <= now).
 */
export function isKnowledgeItemInTrainingPipeline(
  status: string,
  runAfter: Date | null | undefined,
  now: Date,
): boolean {
  if (status === 'processing') return true;
  if (status === 'queued') return isScheduledRunDue(runAfter, now);
  return false;
}

/** Row badge for GET `/training/pending-items` (action-needed list). */
export function actionNeededItemDisplayStatus(
  status: string,
  runAfter: Date | null | undefined,
  now: Date,
): 'needs_training' | 'failed' | 'scheduled' | null {
  if (status === 'pending') return 'needs_training';
  if (status === 'failed') return 'failed';
  if (status === 'queued' && runAfter != null && runAfter.getTime() > now.getTime()) return 'scheduled';
  return null;
}
