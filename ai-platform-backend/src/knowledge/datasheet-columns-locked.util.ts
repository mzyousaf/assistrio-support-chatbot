import { HttpException, HttpStatus } from '@nestjs/common';

/** Error payload shape for datasheet column structure changes after import is finalized. */
export const DATASHEET_COLUMNS_LOCKED_MESSAGE =
  'Columns are locked after import. You can add, edit, or delete rows.' as const;

export const DATASHEET_COLUMNS_LOCKED_CODE = 'datasheet_columns_locked' as const;

/**
 * Columns are locked only after a successful import has been persisted (`importPhase: complete` or `importedAt`).
 * Placeholders during async import use `import_queued` / `importing` — those are blocked separately.
 */
export function datasheetColumnsLockedFromTableMeta(tableMeta: unknown): boolean {
  if (tableMeta == null || typeof tableMeta !== 'object') return false;
  const tm = tableMeta as Record<string, unknown>;
  if (tm.importPhase === 'complete') return true;
  if (tm.importedAt != null && tm.importedAt !== '') return true;
  return false;
}

export function parseTableColumnsFromRawContent(rawContent: string | undefined): string[] | null {
  if (typeof rawContent !== 'string' || !rawContent.trim()) return null;
  try {
    const p = JSON.parse(rawContent) as { columns?: unknown };
    if (!Array.isArray(p.columns)) return null;
    return p.columns.map((c) => String(c ?? ''));
  } catch {
    return null;
  }
}

/** Same length, same header string per index (trimmed). Detects rename/reorder/add/remove. */
export function datasheetColumnHeadersEqual(stored: string[], incoming: string[]): boolean {
  if (stored.length !== incoming.length) return false;
  for (let i = 0; i < stored.length; i++) {
    if (String(stored[i] ?? '').trim() !== String(incoming[i] ?? '').trim()) return false;
  }
  return true;
}

export function assertDatasheetColumnsUnchangedIfLocked(params: {
  tableMeta: unknown;
  rawContent: string | undefined;
  incomingColumns: string[];
}): void {
  if (!datasheetColumnsLockedFromTableMeta(params.tableMeta)) return;
  const stored = parseTableColumnsFromRawContent(params.rawContent);
  if (stored == null) return;
  if (datasheetColumnHeadersEqual(stored, params.incomingColumns)) return;
  throw new HttpException(
    {
      error: DATASHEET_COLUMNS_LOCKED_MESSAGE,
      errorCode: DATASHEET_COLUMNS_LOCKED_CODE,
    },
    HttpStatus.BAD_REQUEST,
  );
}
