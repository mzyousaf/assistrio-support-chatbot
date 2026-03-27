/**
 * Timeout and retry policy for external AI calls (embeddings, completions, summary).
 * Centralized to avoid scattered logic; retries only for transient failures.
 */

/** Default timeouts (ms). Overridable via env if needed. */
export const AI_CALL_TIMEOUTS = {
  embedding: Number(process.env.CHAT_EMBED_TIMEOUT_MS) || 30_000,
  completion: Number(process.env.CHAT_COMPLETION_TIMEOUT_MS) || 60_000,
  summary: Number(process.env.CHAT_SUMMARY_TIMEOUT_MS) || 45_000,
};

/** Max retries (so total attempts = 1 + maxRetries). */
export const AI_CALL_MAX_RETRIES = 2;

/** Backoff base ms before first retry. */
export const AI_CALL_RETRY_DELAY_MS = 1_000;

/**
 * Run a promise with a timeout. Rejects with an Error whose message is "timeout" on timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label?: string,
): Promise<T> {
  if (ms <= 0) return promise;
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(label ? `timeout:${label}` : 'timeout')), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (err) {
    clearTimeout(timeoutId!);
    throw err;
  }
}

/** Return true if the error is likely transient (retry-safe). */
export function isRetryableAiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const s = msg.toLowerCase();
  if (s.includes('timeout') || s.includes('etimedout') || s.includes('econnreset')) return true;
  if (s.includes('rate') && (s.includes('limit') || s.includes('exceeded'))) return true;
  if (s.includes('503') || s.includes('502') || s.includes('429')) return true;
  if (s.includes('econnrefused') || s.includes('network')) return true;
  return false;
}

/** Return true if the error is permanent (do not retry). */
export function isPermanentAiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const s = msg.toLowerCase();
  if (s.includes('invalid') && (s.includes('key') || s.includes('api'))) return true;
  if (s.includes('authentication') || s.includes('unauthorized')) return true;
  if (s.includes('400') || s.includes('invalid request')) return true;
  return false;
}

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  isRetryable?: (err: unknown) => boolean;
}

/**
 * Run fn with retries. Only retries when isRetryable(err) is true.
 * Last attempt error is thrown.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? AI_CALL_MAX_RETRIES;
  const delayMs = options.delayMs ?? AI_CALL_RETRY_DELAY_MS;
  const isRetryable = options.isRetryable ?? isRetryableAiError;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries) break;
      if (isPermanentAiError(err)) break;
      if (!isRetryable(err)) break;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}
