/**
 * MVP training duration estimates (not tied to lastTrainedAt; uses workload + wait until runAfter).
 */
export const TRAINING_ESTIMATE_CHARS_PER_MINUTE = 15_000;
export const TRAINING_ESTIMATE_DATASHEET_ROWS_PER_MINUTE = 1_000;
export const TRAINING_ESTIMATE_DOCUMENT_BUFFER_SECONDS = 60;

export type TrainingQueueEstimateInput = {
  /** Characters across queued + processing trainable work (embedding-sized text). */
  workloadCharacters: number;
  /** Data sheet rows in queued+processing table items. */
  datasheetRowCount: number;
  /** Document KB items in queued or processing. */
  documentItemCount: number;
  /** Seconds until the earliest runAfter (0 if due now or unknown). */
  waitUntilStartSeconds: number;
};

/**
 * Heuristic: character volume dominates; rows add time; each document adds extraction buffer.
 */
export function computeTrainingTimeEstimateSeconds(input: TrainingQueueEstimateInput): number {
  const charPart =
    (Math.max(0, input.workloadCharacters) / TRAINING_ESTIMATE_CHARS_PER_MINUTE) * 60;
  const rowPart = (Math.max(0, input.datasheetRowCount) / TRAINING_ESTIMATE_DATASHEET_ROWS_PER_MINUTE) * 60;
  const docBuffer = Math.max(0, input.documentItemCount) * TRAINING_ESTIMATE_DOCUMENT_BUFFER_SECONDS;
  const work = Math.max(0, charPart + rowPart + docBuffer);
  return Math.max(0, Math.ceil(input.waitUntilStartSeconds + work));
}

export function trainingTimeEstimateLabel(estimatedSeconds: number): string {
  if (!Number.isFinite(estimatedSeconds) || estimatedSeconds < 60) {
    return 'Less than a minute';
  }
  if (estimatedSeconds < 120) {
    return 'About 1–2 minutes';
  }
  if (estimatedSeconds < 5 * 60) {
    return 'About 3–5 minutes';
  }
  if (estimatedSeconds < 10 * 60) {
    return 'About 5–10 minutes';
  }
  return 'More than 10 minutes';
}
