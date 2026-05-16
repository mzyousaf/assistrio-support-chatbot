/**
 * Structured logs for KB worker crons. Gated by `KB_CRON_LOGS` (global default) and optional per-cron env vars
 * (`KB_CRON_LOG_*`, see `.env.example`). Only the string `true` enables logging. Emits JSON lines — no secrets or content.
 */
export type KbCronLogMeta = Record<string, string | number | boolean | null | undefined>;

/** `cron` field in JSON lines → `process.env` key for per-cron override. */
export const KB_CRON_LOG_ENV_BY_CRON: Record<string, string> = {
  content_extraction: 'KB_CRON_LOG_CONTENT_EXTRACTION',
  knowledge_training: 'KB_CRON_LOG_KNOWLEDGE_TRAINING',
  table_import: 'KB_CRON_LOG_TABLE_IMPORT',
  summary_jobs: 'KB_CRON_LOG_SUMMARY_JOBS',
  knowledge_item_purge: 'KB_CRON_LOG_KNOWLEDGE_PURGE',
  bot_purge: 'KB_CRON_LOG_BOT_PURGE',
  extraction_status_backfill: 'KB_CRON_LOG_BACKFILL',
  app_boot: 'KB_CRON_LOG_APP_BOOT',
};

/** Global default when a per-cron flag is unset (or cron name is unknown). */
export function shouldLogKbCron(): boolean {
  return process.env.KB_CRON_LOGS === 'true';
}

/**
 * Effective log toggle for one cron. Per-cron env wins when set to `true` or `false`; otherwise uses {@link shouldLogKbCron}.
 * Only `true` / `false` are meaningful overrides; any other set value falls back to global (same as unset).
 */
export function shouldLogKbCronFor(cronName: string): boolean {
  const envName = KB_CRON_LOG_ENV_BY_CRON[cronName];
  if (envName) {
    const v = process.env[envName];
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return shouldLogKbCron();
}

function emit(
  phase: 'start' | 'finish' | 'skip' | 'error',
  name: string,
  payload: KbCronLogMeta,
): void {
  if (!shouldLogKbCronFor(name)) return;
  const line = JSON.stringify({
    kbCron: true,
    phase,
    cron: name,
    ts: new Date().toISOString(),
    ...payload,
  });
  if (phase === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function logCronStart(name: string, meta?: KbCronLogMeta): void {
  emit('start', name, meta ?? {});
}

export function logCronFinish(name: string, meta: KbCronLogMeta & { durationMs: number }): void {
  emit('finish', name, meta);
}

export function logCronSkip(name: string, reason: string, meta?: KbCronLogMeta): void {
  emit('skip', name, { reason, ...meta });
}

const STACK_CAP = 2500;

export function logCronError(name: string, err: unknown, meta?: KbCronLogMeta): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack =
    err instanceof Error && typeof err.stack === 'string'
      ? err.stack.slice(0, STACK_CAP)
      : undefined;
  emit('error', name, {
    message,
    ...(stack ? { stack } : {}),
    ...meta,
  });
}
