import * as XLSX from 'xlsx';
import { BOT_FIELD_MAX, clampStr, KNOWLEDGE_TABLE_MAX_COLUMNS, KNOWLEDGE_TABLE_MAX_ROWS } from './shared/bot-field-limits';

const DATASHEET_IMPORT_EXTS = new Set(['csv', 'xlsx', 'xls']);

/** Rows returned from preview API (first data rows only). */
export const DATASHEET_PREVIEW_MAX_ROWS = 10;

export function isDatasheetImportExtension(ext: string): boolean {
  return DATASHEET_IMPORT_EXTS.has(ext.toLowerCase().replace(/^\./, ''));
}

/**
 * First sheet: row 0 = column headers, following rows = data. Matches customer `parseSpreadsheetToGrid` behavior.
 */
export function parseDatasheetFileBuffer(
  buffer: Buffer,
  _fileName: string,
): { columns: string[]; rows: string[][]; parseError?: string } {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const name = wb.SheetNames[0];
    if (!name) return { columns: [], rows: [], parseError: 'No sheet found in file.' };
    const sheet = wb.Sheets[name];
    if (!sheet) return { columns: [], rows: [], parseError: 'No sheet found in file.' };
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
    if (!data.length) return { columns: [], rows: [], parseError: 'Sheet is empty.' };
    const headerRow = data[0] as unknown[];
    const columns = headerRow
      .map((c) => clampStr(String(c ?? '').trim(), BOT_FIELD_MAX.knowledgeDatasheetCell))
      .slice(0, KNOWLEDGE_TABLE_MAX_COLUMNS);
    const n = Math.max(0, columns.length);
    if (n === 0) return { columns: [], rows: [] };
    const rows: string[][] = [];
    for (let r = 1; r < data.length && rows.length < KNOWLEDGE_TABLE_MAX_ROWS; r++) {
      const line = (data[r] as unknown[]) ?? [];
      const row: string[] = [];
      for (let c = 0; c < n; c++) {
        row.push(clampStr(String(line[c] ?? '').trim(), BOT_FIELD_MAX.knowledgeDatasheetCell));
      }
      if (row.some((x) => x.length > 0)) rows.push(row);
    }
    return { columns, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not parse file.';
    return { columns: [], rows: [], parseError: msg };
  }
}
