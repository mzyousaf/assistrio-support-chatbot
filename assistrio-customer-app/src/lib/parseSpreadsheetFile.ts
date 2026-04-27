import * as XLSX from 'xlsx';

/** First sheet: row 0 = column headers, following rows = data. */
export function parseSpreadsheetToGrid(file: File): Promise<{ columns: string[]; rows: string[][] }> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: 'array' });
    const name = wb.SheetNames[0];
    if (!name) return { columns: [], rows: [] };
    const sheet = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
    if (!data.length) return { columns: [], rows: [] };
    const headerRow = data[0] as unknown[];
    const columns = headerRow.map((c) => String(c ?? '').trim());
    const n = Math.max(1, columns.length);
    const rows: string[][] = [];
    for (let r = 1; r < data.length; r++) {
      const line = (data[r] as unknown[]) ?? [];
      const row: string[] = [];
      for (let c = 0; c < n; c++) row.push(String(line[c] ?? '').trim());
      if (row.some((x) => x.length > 0)) rows.push(row);
    }
    return { columns, rows };
  });
}
