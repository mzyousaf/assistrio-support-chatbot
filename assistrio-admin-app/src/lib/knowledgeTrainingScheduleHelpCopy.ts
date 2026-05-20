/**
 * Short delay hints for the training-timer help modal.
 * Aligned with `ai-platform-backend/src/knowledge/knowledge-smart-schedule.util.ts`.
 */

export const KNOWLEDGE_SMART_DELAY_ROWS: { source: string; waitLabel: string }[] = [
  { source: 'Q&A, snippets, suggestions', waitLabel: '~30 sec' },
  { source: 'Documents', waitLabel: '~1 min' },
  { source: 'Datasheets (typical size)', waitLabel: '~5 min' },
  { source: 'Datasheets (very large)', waitLabel: '~20 min' },
];
