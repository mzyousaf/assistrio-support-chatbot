/**
 * Verbose knowledge-base training / extraction logs (opt-in to avoid noisy production logs).
 * Prefer `KB_TRAINING_LOGS=true` or `1`. `DEBUG_KB_TRAINING` is a legacy alias with the same effect.
 */
export function kbTrainingVerboseLogsEnabled(): boolean {
  const k = process.env.KB_TRAINING_LOGS?.trim().toLowerCase();
  const d = process.env.DEBUG_KB_TRAINING?.trim().toLowerCase();
  return k === 'true' || k === '1' || d === 'true' || d === '1';
}

export function kbTrainingLog(message: string, meta?: Record<string, unknown>): void {
  if (!kbTrainingVerboseLogsEnabled()) return;
  if (meta && Object.keys(meta).length > 0) {
    console.log(`[kb-training] ${message}`, meta);
  } else {
    console.log(`[kb-training] ${message}`);
  }
}
