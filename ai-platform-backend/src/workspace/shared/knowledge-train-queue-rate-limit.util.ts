import { HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitService } from '../../rate-limit/rate-limit.service';
import {
  KNOWLEDGE_TRAIN_QUEUE_RATE_LIMIT_MAX_PER_WINDOW,
  KNOWLEDGE_TRAIN_QUEUE_RATE_LIMIT_WINDOW_MS,
} from '../../lib/global.constants';

/** Limits burst queue churn from train-now / retrain / retry-failed / queue-pending per bot per user (Mongo-backed). */
export async function assertKnowledgeTrainQueueRateLimit(
  rateLimitService: RateLimitService,
  botId: string,
  userId: string,
): Promise<void> {
  const uid = userId.trim() || 'unknown';
  const r = await rateLimitService.check({
    key: `cust_kb_train_queue:${botId}:${uid}`,
    limit: KNOWLEDGE_TRAIN_QUEUE_RATE_LIMIT_MAX_PER_WINDOW,
    windowMs: KNOWLEDGE_TRAIN_QUEUE_RATE_LIMIT_WINDOW_MS,
  });
  if (!r.allowed) {
    throw new HttpException(
      {
        error: 'Too many training queue requests. Please wait and try again.',
        errorCode: 'train_queue_rate_limited',
        retryAfterSeconds: Math.ceil(KNOWLEDGE_TRAIN_QUEUE_RATE_LIMIT_WINDOW_MS / 1000),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
