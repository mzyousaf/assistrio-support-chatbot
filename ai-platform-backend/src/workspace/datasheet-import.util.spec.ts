import * as XLSX from 'xlsx';
import {
  applyDatasheetColumnDrops,
  assertTableKnowledgeFitsMongoPersistOrThrow,
  parseDatasheetFileBuffer,
  TableDatasheetValidationError,
  tableKnowledgePersistUtf8ByteTotal,
  validateDatasheetGridOrThrow,
} from './datasheet-import.util';
import {
  BOT_FIELD_MAX,
  KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES,
  KNOWLEDGE_TABLE_MAX_ROWS,
  KNOWLEDGE_TABLE_PERSIST_MAX_UTF8_BYTES,
  utf8ByteLength,
} from './shared/bot-field-limits';

describe('parseDatasheetFileBuffer', () => {
  it('returns parseError when first sheet is empty', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, 'S1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const r = parseDatasheetFileBuffer(Buffer.from(buf), 'empty.xlsx');
    expect(r.columns.length).toBe(0);
    expect(r.rows.length).toBe(0);
    expect(r.parseError).toMatch(/empty|sheet/i);
  });

  it('header-only xlsx yields columns and zero data rows (import layer rejects this)', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['A', 'B', 'C']]);
    XLSX.utils.book_append_sheet(wb, ws, 'S1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const r = parseDatasheetFileBuffer(Buffer.from(buf), 'headers.xlsx');
    expect(r.columns).toEqual(['A', 'B', 'C']);
    expect(r.rows).toEqual([]);
  });

  it('parses CSV buffer with headers and data', () => {
    const csv = 'Name,Qty\nAlice,1\nBob,2\n';
    const r = parseDatasheetFileBuffer(Buffer.from(csv, 'utf8'), 't.csv');
    expect(r.columns).toEqual(['Name', 'Qty']);
    expect(r.rows).toEqual([
      ['Alice', '1'],
      ['Bob', '2'],
    ]);
  });

  it('drops data rows that are entirely blank', () => {
    const csv = 'A,B\n,\nX,Y\n';
    const r = parseDatasheetFileBuffer(Buffer.from(csv, 'utf8'), 't.csv');
    expect(r.rows).toEqual([['X', 'Y']]);
  });

  it('estimatedDataRows can exceed returned rows when maxDataRows caps collect', () => {
    const csv = 'C\n1\n2\n3\n4\n5\n';
    const r = parseDatasheetFileBuffer(Buffer.from(csv, 'utf8'), 't.csv', { maxDataRows: 2 });
    expect(r.rows).toEqual([['1'], ['2']]);
    expect(r.estimatedDataRows).toBe(5);
  });

  it('returns xlsx_too_large for xlsx when buffer exceeds maxSourceBytes (before workbook parse)', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['A'],
      ['1'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'S1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const r = parseDatasheetFileBuffer(Buffer.from(buf), 'big.xlsx', { maxSourceBytes: 10 });
    expect(r.columns.length).toBe(0);
    expect(r.parseErrorCode).toBe('xlsx_too_large');
    expect(r.parseError).toMatch(/too large/i);
  });

  it('rejects when first sheet physical row span exceeds env cap', () => {
    const prev = process.env.TABLE_IMPORT_BUFFER_PARSE_MAX_PHYSICAL_ROWS;
    process.env.TABLE_IMPORT_BUFFER_PARSE_MAX_PHYSICAL_ROWS = '4';
    try {
      const wb = XLSX.utils.book_new();
      const aoa = [['H'], ['1'], ['2'], ['3'], ['4'], ['5']];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, 'S1');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const r = parseDatasheetFileBuffer(Buffer.from(buf), 'tall.xlsx', { maxSourceBytes: 2_000_000 });
      expect(r.columns.length).toBe(0);
      expect(r.parseErrorCode).toBe('xlsx_too_many_physical_rows');
    } finally {
      process.env.TABLE_IMPORT_BUFFER_PARSE_MAX_PHYSICAL_ROWS = prev;
    }
  });

  it('returns cell_too_long when a body cell exceeds import limits', () => {
    const long = 'z'.repeat(BOT_FIELD_MAX.knowledgeDatasheetCell + 1);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['A'], [long]]);
    XLSX.utils.book_append_sheet(wb, ws, 'S1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const r = parseDatasheetFileBuffer(Buffer.from(buf), 'cell.xlsx', { maxSourceBytes: 5_000_000 });
    expect(r.columns.length).toBe(0);
    expect(r.parseErrorCode).toBe('cell_too_long');
  });

  it('returns controlled parse_error for truncated xlsx buffer', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['A'],
      ['1'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'S1');
    const full = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const r = parseDatasheetFileBuffer(full.subarray(0, 40), 'bad.xlsx', { maxSourceBytes: 2_000_000 });
    expect(r.columns.length).toBe(0);
    expect(r.parseError).toBeTruthy();
    expect(r.parseErrorCode).toBe('parse_error');
  });
});

describe('applyDatasheetColumnDrops', () => {
  it('drops by 0-based indices in stable order', () => {
    const { columns, rows } = applyDatasheetColumnDrops(
      ['A', 'B', 'C'],
      [
        ['1', '2', '3'],
        ['4', '5', '6'],
      ],
      [0, 2],
    );
    expect(columns).toEqual(['B']);
    expect(rows).toEqual([['2'], ['5']]);
  });
});

describe('tableKnowledgePersistUtf8ByteTotal / mongo document cap', () => {
  function gridUtf8Bytes(title: string, columns: string[], rows: string[][]): number {
    let n = utf8ByteLength(title);
    for (const c of columns) n += utf8ByteLength(c);
    for (const r of rows) for (const cell of r) n += utf8ByteLength(cell);
    return n;
  }

  it('accepts a grid just under both logical grid and persist caps, rejects slightly larger persist', () => {
    const title = 'T';
    const columns = ['C'];
    const rowCount = KNOWLEDGE_TABLE_MAX_ROWS;
    let lo = 1;
    let hi = BOT_FIELD_MAX.knowledgeDatasheetCell;
    let best = 1;
    while (lo <= hi) {
      const w = Math.floor((lo + hi) / 2);
      const rows = Array.from({ length: rowCount }, () => ['a'.repeat(w)]);
      const g = gridUtf8Bytes(title, columns, rows);
      const p = tableKnowledgePersistUtf8ByteTotal(title, columns, rows);
      if (
        g <= KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES &&
        p <= KNOWLEDGE_TABLE_PERSIST_MAX_UTF8_BYTES - 24_000
      ) {
        best = w;
        lo = w + 1;
      } else hi = w - 1;
    }
    const okRows = Array.from({ length: rowCount }, () => ['a'.repeat(best)]);
    expect(() => validateDatasheetGridOrThrow(title, columns, okRows)).not.toThrow();

    const bump = Math.min(400, BOT_FIELD_MAX.knowledgeDatasheetCell - best);
    if (bump <= 0) return;
    const bigRows = Array.from({ length: rowCount }, () => ['a'.repeat(best + bump)]);
    expect(() => validateDatasheetGridOrThrow(title, columns, bigRows)).toThrow(TableDatasheetValidationError);
    try {
      validateDatasheetGridOrThrow(title, columns, bigRows);
    } catch (e) {
      expect(['persist_too_large', 'grid_too_large']).toContain((e as TableDatasheetValidationError).code);
    }
  });

  it('rejects when JSON escaping inflates rawContent over persist cap', () => {
    const cell = '"'.repeat(5_000_000);
    expect(() => assertTableKnowledgeFitsMongoPersistOrThrow('t', ['c'], [[cell]])).toThrow(
      TableDatasheetValidationError,
    );
    try {
      assertTableKnowledgeFitsMongoPersistOrThrow('t', ['c'], [[cell]]);
    } catch (e) {
      expect(e).toMatchObject({ code: 'persist_too_large' });
    }
  });
});

describe('validateDatasheetGridOrThrow', () => {
  it('rejects header-only grid', () => {
    expect(() => validateDatasheetGridOrThrow('t', ['A'], [])).toThrow(TableDatasheetValidationError);
    try {
      validateDatasheetGridOrThrow('t', ['A'], []);
    } catch (e) {
      expect(e).toMatchObject({ code: 'header_only' });
    }
  });

  it('accepts minimal valid grid', () => {
    expect(() => validateDatasheetGridOrThrow('t', ['A'], [['x']])).not.toThrow();
  });
});
