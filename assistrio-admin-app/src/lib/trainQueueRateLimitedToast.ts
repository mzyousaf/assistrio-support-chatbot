import { appToast } from '@/lib/app-toast';

/** Backend rate limit on `POST …/knowledge/training/retrain-agent` (`train_queue_rate_limited`). */
export const TRAIN_QUEUE_RATE_LIMIT_ERROR_CODE = 'train_queue_rate_limited' as const;

const DEFAULT_MESSAGE = 'Too many queue requests. Please wait and try again.';

/**
 * When a training-queue mutation is rate-limited, the API returns `errorCode: train_queue_rate_limited`
 * (usually 429). Show an informational toast instead of a generic error.
 *
 * @returns `true` if this case was handled — caller should return early and skip their generic error toast.
 */
export function toastIfTrainQueueRateLimited(res: {
  ok: boolean;
  error?: string;
  errorCode?: string;
}): boolean {
  if (res.ok) return false;
  if (res.errorCode === TRAIN_QUEUE_RATE_LIMIT_ERROR_CODE) {
    appToast.info(res.error?.trim() || DEFAULT_MESSAGE);
    return true;
  }
  return false;
}
