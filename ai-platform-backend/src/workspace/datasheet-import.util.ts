import * as XLSX from 'xlsx';
import { buildTableEmbeddingText } from '../knowledge/faq-note-embedding.helper';
import {
  BOT_FIELD_MAX,
  clampStr,
  KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES,
  KNOWLEDGE_TABLE_MAX_COLUMNS,
  KNOWLEDGE_TABLE_MAX_ROWS,
  KNOWLEDGE_TABLE_PERSIST_MAX_UTF8_BYTES,
  tableImportBufferParseMaxPhysicalRowsFromEnv,
  utf8ByteLength,
} from './shared/bot-field-limits';

const DATASHEET_IMPORT_EXTS = new Set(['csv', 'xlsx', 'xls']);

/** Rows returned from preview API (first data rows only). */
export const DATASHEET_PREVIEW_MAX_ROWS = 10;

export function isDatasheetCsvFileName(fileName: string): boolean {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  return ext === 'csv';
}

export function isDatasheetImportExtension(ext: string): boolean {
  return DATASHEET_IMPORT_EXTS.has(ext.toLowerCase().replace(/^\./, ''));
}

export type DatasheetParseOptions = {
  /** Max data rows to collect (excluding header). Default {@link KNOWLEDGE_TABLE_MAX_ROWS}. */
  maxDataRows?: number;
  /**
   * For `.xlsx`/`.xls` only — reject before loading the workbook when buffer exceeds this size (bytes).
   * CSV uses the streaming import path instead.
   */
  maxSourceBytes?: number;
};

/** Customer-facing message; matches CSV streaming import. */
export const DATASHEET_PARSE_CELL_TOO_LONG_MESSAGE =
  'A cell exceeds the maximum allowed length. Shorten long cells and try again.';

export type DatasheetParseResult = {
  columns: string[];
  rows: string[][];
  parseError?: string;
  /** Machine-oriented code for workers when `parseError` is set and `columns` is empty. */
  parseErrorCode?: 'xlsx_too_large' | 'xlsx_too_many_physical_rows' | 'cell_too_long' | 'parse_error';
  /** Non-empty body rows detected in sheet (capped scan); may exceed `rows.length` when `maxDataRows` is lower. */
  estimatedDataRows?: number;
};

function gridUtf8Bytes(title: string, columns: string[], rows: string[][]): number {
  let n = utf8ByteLength(title ?? '');
  for (const c of columns ?? []) n += utf8ByteLength(String(c ?? ''));
  for (const r of rows ?? []) for (const cell of r ?? []) n += utf8ByteLength(String(cell ?? ''));
  return n;
}

export class TableDatasheetValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TableDatasheetValidationError';
  }
}

/**
 * Combined UTF-8 size of what we persist on one table item: `rawContent` JSON + embedding `content` string.
 * Must stay ≤ {@link KNOWLEDGE_TABLE_PERSIST_MAX_UTF8_BYTES} (~14 MiB) so the MongoDB document stays under 16 MiB BSON.
 */
export function tableKnowledgePersistUtf8ByteTotal(title: string, columns: string[], rows: string[][]): number {
  const rawPayload = JSON.stringify({ title, columns, rows });
  const content = buildTableEmbeddingText(title, columns, rows);
  return utf8ByteLength(rawPayload) + utf8ByteLength(content);
}

export function assertTableKnowledgeFitsMongoPersistOrThrow(title: string, columns: string[], rows: string[][]): void {
  const n = tableKnowledgePersistUtf8ByteTotal(title, columns, rows);
  if (n > KNOWLEDGE_TABLE_PERSIST_MAX_UTF8_BYTES) {
    throw new TableDatasheetValidationError(
      'persist_too_large',
      'Table is too large to store in one knowledge row (MongoDB 16MB document limit). Reduce rows or cell text.',
    );
  }
}

/**
 * Apply 0-based column drops (stable sort descending recommended); trims row width.
 */
export function applyDatasheetColumnDrops(
  columns: string[],
  rows: string[][],
  dropZeroBased: number[] | undefined,
): { columns: string[]; rows: string[][] } {
  if (!dropZeroBased?.length) return { columns, rows };
  const drops = [...new Set(dropZeroBased.filter((i) => Number.isFinite(i) && i >= 0 && i < columns.length))].sort(
    (a, b) => b - a,
  );
  let cols = [...columns];
  let rs = rows.map((r) => [...r]);
  for (const i of drops) {
    cols = cols.filter((_, j) => j !== i);
    rs = rs.map((r) => r.filter((_, j) => j !== i));
  }
  return { columns: cols, rows: rs };
}

function cellExceedsDatasheetImportLimit(raw: unknown): boolean {
  const t = String(raw ?? '').trim();
  const max = BOT_FIELD_MAX.knowledgeDatasheetCell;
  return t.length > max || utf8ByteLength(t) > max;
}

export function validateDatasheetGridOrThrow(title: string, columns: string[], rows: string[][]): void {
  if (!columns.length || columns.every((c) => String(c ?? '').trim() === '')) {
    throw new TableDatasheetValidationError('no_headers', 'No column headers found.');
  }
  if (!rows.length) {
    throw new TableDatasheetValidationError('header_only', 'No data rows found (header-only sheet).');
  }
  if (columns.length > KNOWLEDGE_TABLE_MAX_COLUMNS) {
    throw new TableDatasheetValidationError('too_many_columns', 'Too many columns for import.');
  }
  if (rows.length > KNOWLEDGE_TABLE_MAX_ROWS) {
    throw new TableDatasheetValidationError('too_many_rows', 'Too many rows for import.');
  }
  const g = gridUtf8Bytes(title, columns, rows);
  if (g > KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES) {
    throw new TableDatasheetValidationError('grid_too_large', 'Datasheet exceeds maximum stored size.');
  }
  assertTableKnowledgeFitsMongoPersistOrThrow(title, columns, rows);
}

/**
 * First sheet: row 0 = column headers, following rows = data. Matches customer `parseSpreadsheetToGrid` behavior.
 *
 * **Memory:** Uses `XLSX.read` (full workbook in memory). Safe in production only because callers enforce
 * {@link DatasheetParseOptions.maxSourceBytes} for Excel and a max first-sheet physical row span
 * ({@link tableImportBufferParseMaxPhysicalRowsFromEnv}); CSV from S3 uses {@link streamImportCsvDatasheet} instead.
 */
export function parseDatasheetFileBuffer(
  buffer: Buffer,
  _fileName: string,
  opts?: DatasheetParseOptions,
): DatasheetParseResult {
  const maxDataRows = Math.min(
    KNOWLEDGE_TABLE_MAX_ROWS,
    Math.max(1, Math.floor(opts?.maxDataRows ?? KNOWLEDGE_TABLE_MAX_ROWS)),
  );
  const ext = (_fileName.split('.').pop() ?? '').toLowerCase();
  if ((ext === 'xlsx' || ext === 'xls') && opts?.maxSourceBytes != null && buffer.length > opts.maxSourceBytes) {
    return {
      columns: [],
      rows: [],
      parseError:
        'This Excel file is too large to import in this format. Export to CSV for large tables, or use a smaller workbook.',
      parseErrorCode: 'xlsx_too_large',
    };
  }
  try {
    // Workbook load is bounded by maxSourceBytes (xlsx/xls) and multipart plan cap; grid output is bounded by !ref height.
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const name = wb.SheetNames[0];
    if (!name) return { columns: [], rows: [], parseError: 'No sheet found in file.' };
    const sheet = wb.Sheets[name];
    if (!sheet) return { columns: [], rows: [], parseError: 'No sheet found in file.' };
    if (sheet['!ref'] == null) return { columns: [], rows: [], parseError: 'Sheet is empty.' };
    const fullRange = XLSX.utils.decode_range(sheet['!ref']);
    const physicalRows = fullRange.e.r - fullRange.s.r + 1;
    const maxPhysical = tableImportBufferParseMaxPhysicalRowsFromEnv();
    if (physicalRows > maxPhysical) {
      return {
        columns: [],
        rows: [],
        parseError:
          'This spreadsheet has too many rows for Excel import. Export to CSV instead, or split the file into smaller sheets.',
        parseErrorCode: 'xlsx_too_many_physical_rows',
      };
    }
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
      range: fullRange,
    });
    if (!data.length) return { columns: [], rows: [], parseError: 'Sheet is empty.' };
    const headerRow = data[0] as unknown[];
    for (const c of headerRow.slice(0, KNOWLEDGE_TABLE_MAX_COLUMNS)) {
      if (cellExceedsDatasheetImportLimit(c)) {
        return {
          columns: [],
          rows: [],
          parseError: DATASHEET_PARSE_CELL_TOO_LONG_MESSAGE,
          parseErrorCode: 'cell_too_long',
        };
      }
    }
    const columns = headerRow
      .map((c) => clampStr(String(c ?? '').trim(), BOT_FIELD_MAX.knowledgeDatasheetCell))
      .slice(0, KNOWLEDGE_TABLE_MAX_COLUMNS);
    const n = Math.max(0, columns.length);
    if (n === 0) return { columns: [], rows: [] };
    const rows: string[][] = [];
    let nonEmptyBodyRows = 0;
    for (let r = 1; r < data.length; r++) {
      const line = (data[r] as unknown[]) ?? [];
      for (let c = 0; c < n; c++) {
        if (cellExceedsDatasheetImportLimit(line[c])) {
          return {
            columns: [],
            rows: [],
            parseError: DATASHEET_PARSE_CELL_TOO_LONG_MESSAGE,
            parseErrorCode: 'cell_too_long',
          };
        }
      }
      const row: string[] = [];
      for (let c = 0; c < n; c++) {
        row.push(clampStr(String(line[c] ?? '').trim(), BOT_FIELD_MAX.knowledgeDatasheetCell));
      }
      if (!row.some((x) => x.length > 0)) continue;
      nonEmptyBodyRows++;
      if (rows.length < maxDataRows) rows.push(row);
    }
    return { columns, rows, estimatedDataRows: nonEmptyBodyRows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not parse file.';
    return { columns: [], rows: [], parseError: msg, parseErrorCode: 'parse_error' };
  }
}
