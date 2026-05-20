import type { AdminKnowledgeStatusItem } from '@/api/types';
import {
  mergeKbTrainingLifecycleForDisplay,
  normalizeKnowledgeTrainingStatus,
  type KnowledgeTrainingStatus,
} from '@/lib/knowledgeTrainingStatus';

export function kbStatusPollLifecycleRaw(u: AdminKnowledgeStatusItem): string {
  const ts = u.trainingStatus != null && String(u.trainingStatus).trim();
  if (ts === 'out_of_storage') return 'out_of_storage';
  if (ts) return String(u.trainingStatus).trim();
  return String(u.status ?? '');
}

export function kbDetailLifecycleRawForDisplay(
  rowTraining: KnowledgeTrainingStatus | string | null | undefined,
  poll: AdminKnowledgeStatusItem,
): KnowledgeTrainingStatus | string | null | undefined {
  const pNorm = normalizeKnowledgeTrainingStatus(poll.status);
  const pollParallel = poll.trainingStatus != null && String(poll.trainingStatus).trim();
  const parallelNorm = pollParallel ? normalizeKnowledgeTrainingStatus(poll.trainingStatus) : null;

  const trustPrimaryPollReady = pNorm === 'ready' && poll.isTraining !== true;
  if (trustPrimaryPollReady) {
    if (parallelNorm === 'out_of_storage' || parallelNorm === 'failed') {
      return kbStatusPollLifecycleRaw(poll);
    }
    return 'ready';
  }

  return mergeKbTrainingLifecycleForDisplay(rowTraining, poll.status);
}

export function kbPollRunAfterIso(u: AdminKnowledgeStatusItem): string | null {
  const v = u.runAfter;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
