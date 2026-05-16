/**
 * UI/API states for async datasheet import + training (not document extraction).
 * `preview_ready` is client-only (before confirm).
 */
export type TableImportDisplayState =
  | 'import_queued'
  | 'importing_table'
  | 'import_failed'
  | 'waiting_for_training'
  | 'training_queued'
  | 'training'
  | 'ready'
  | 'training_failed';

export function tableImportDisplayStateFromKb(row: {
  status?: string;
  tableMeta?: { importPhase?: string };
}): TableImportDisplayState {
  const phase = row.tableMeta?.importPhase;
  if (phase === 'import_queued') return 'import_queued';
  if (phase === 'importing') return 'importing_table';
  if (phase === 'import_failed') return 'import_failed';
  const st = String(row.status ?? 'pending');
  if (st === 'pending') return 'waiting_for_training';
  if (st === 'queued') return 'training_queued';
  if (st === 'processing') return 'training';
  if (st === 'ready') return 'ready';
  if (st === 'failed') return 'training_failed';
  return 'waiting_for_training';
}
