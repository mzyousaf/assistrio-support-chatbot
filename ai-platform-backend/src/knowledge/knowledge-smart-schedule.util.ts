/**
 * Per-source delays for already-trained KB items when Auto Train queues a rerun.
 * Values are **fractional minutes** (e.g. FAQ 0.5 = 30s). First-time trains still use immediate `runAfter`
 * via `computeAutomaticItemRunAfter(..., false)`.
 */
export type KnowledgeSmartScheduleContext =
  | { kind: 'faq' }
  | { kind: 'note' }
  | { kind: 'document' }
  | { kind: 'suggestion' }
  | { kind: 'table'; rowCount: number; approxChars: number };

const DATASHEET_LARGE_ROWS = 80;
const DATASHEET_LARGE_CHARS = 150_000;

/**
 * Delay after queue time before the worker should run (for retrains only).
 * Value is **fractional minutes** (e.g. `0.5` = 30 seconds); see {@link computeAutomaticItemRunAfter}.
 */
export function resolveSmartTrainingDelayMinutes(ctx: KnowledgeSmartScheduleContext): number {
  switch (ctx.kind) {
    case 'faq':
    case 'note':
    case 'suggestion':
      return 0.5;
    case 'document':
      return 1;
    case 'table': {
      if (ctx.rowCount >= DATASHEET_LARGE_ROWS || ctx.approxChars >= DATASHEET_LARGE_CHARS) {
        return 20;
      }
      return 5;
    }
    default:
      return 0.5;
  }
}
