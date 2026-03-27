/**
 * Structured logging for chat/RAG events. Metric-ready shape for production monitoring.
 * Does NOT log: raw prompts, API keys, full user/lead content.
 */

export type ChatLogLevel = 'info' | 'warn' | 'error';

export interface ChatLogEvent {
  event: string;
  level: ChatLogLevel;
  botId?: string;
  conversationId?: string;
  chatVisitorId?: string;
  platformVisitorId?: string;
  requestId?: string;
  retrievalConfidence?: string;
  messageCount?: number;
  durationMs?: number;
  /** Endpoint: trial | demo | user */
  endpoint?: string;
  selectedChunksCount?: number;
  leadFieldsCapturedCount?: number;
  summaryUsed?: boolean;
  retryCount?: number;
  /** Safe short reason (e.g. "timeout", "rate_limit") */
  reason?: string;
  metadata?: Record<string, unknown>;
  /** Latency breakdown (ms). */
  retrievalDurationMs?: number;
  completionDurationMs?: number;
  summaryEnqueueDurationMs?: number;
}

/** Optional hook for metrics (StatsD/Prometheus). Called after log. */
let metricsEmit: ((ev: ChatLogEvent) => void) | null = null;

export function setChatMetricsEmit(fn: (ev: ChatLogEvent) => void): void {
  metricsEmit = fn;
}

function emit(ev: ChatLogEvent): void {
  if (process.env.NODE_ENV === 'test') return;
  const line = JSON.stringify(ev);
  if (ev.level === 'error') console.error(line);
  else if (ev.level === 'warn') console.warn(line);
  else console.info(line);
  try {
    metricsEmit?.(ev);
  } catch {
    // ignore metrics errors
  }
}

export function chatLog(ev: ChatLogEvent): void {
  emit(ev);
}

