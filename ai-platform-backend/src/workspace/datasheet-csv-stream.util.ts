import { StringDecoder } from 'string_decoder';
import { buildTableEmbeddingText } from '../knowledge/faq-note-embedding.helper';
import {
  BOT_FIELD_MAX,
  clampStr,
  KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES,
  KNOWLEDGE_TABLE_MAX_COLUMNS,
  KNOWLEDGE_TABLE_MAX_ROWS,
  TABLE_IMPORT_CSV_BATCH_ROWS_DEFAULT,
  TABLE_IMPORT_CSV_MAX_BUFFER_UTF8_BYTES,
  utf8ByteLength,
} from './shared/bot-field-limits';
import {
  assertTableKnowledgeFitsMongoPersistOrThrow,
  DATASHEET_PARSE_CELL_TOO_LONG_MESSAGE,
  TableDatasheetValidationError,
} from './datasheet-import.util';

export type CsvStreamImportOptions = {
  title: string;
  dropColumnIndices?: number[];
  /** Max non-empty data rows (after header). */
  maxDataRows?: number;
  maxColumns?: number;
  /** Reject when any cell exceeds this character length (strict; no silent clamp). */
  maxCellChars?: number;
  /** Abort after this many bytes read from the stream (worker safety). */
  maxSourceBytes?: number;
  maxGridUtf8Bytes?: number;
  /** Invoke after every N data rows (for yielding / tests). */
  batchSize?: number;
  onDataRowBatch?: (batch: string[][], state: { totalNonEmptyRows: number }) => void | Promise<void>;
};

export type CsvStreamImportResult = {
  columns: string[];
  rows: string[][];
  embeddingText: string;
  gridUtf8Bytes: number;
  dataRowCount: number;
};

function sortUniqueDrops(drops: number[] | undefined, headerLen: number): number[] {
  if (!drops?.length) return [];
  return [...new Set(drops.filter((i) => Number.isFinite(i) && i >= 0 && i < headerLen))].sort((a, b) => b - a);
}

function headerCellsToColumns(headerCells: string[], dropsDescending: number[]): { columns: string[]; keepIdx: number[] } {
  const dropSet = new Set(dropsDescending);
  const keepIdx: number[] = [];
  for (let i = 0; i < headerCells.length; i++) {
    if (!dropSet.has(i)) keepIdx.push(i);
  }
  const cells = keepIdx.map((i) => headerCells[i] ?? '');
  const columns = cells.map((c) => clampStr(String(c ?? '').trim(), BOT_FIELD_MAX.knowledgeDatasheetCell));
  return { columns, keepIdx };
}

function buildDataRowFromCells(
  cells: string[],
  keepIdx: number[],
  expectedWidth: number,
  maxCellChars: number,
): string[] {
  const row: string[] = [];
  for (const i of keepIdx) {
    const raw = String(cells[i] ?? '').trim();
    if (raw.length > maxCellChars || utf8ByteLength(raw) > maxCellChars) {
      throw new TableDatasheetValidationError('cell_too_long', DATASHEET_PARSE_CELL_TOO_LONG_MESSAGE);
    }
    row.push(clampStr(raw, BOT_FIELD_MAX.knowledgeDatasheetCell));
  }
  while (row.length < expectedWidth) row.push('');
  return row.slice(0, expectedWidth);
}

/** Incremental CSV parser (quoted fields, multiline quoted rows, RFC4180-style ""). */
export class CsvIncrementalParser {
  private readonly dec = new StringDecoder('utf8');
  private buf = '';
  private inQuotes = false;
  private field = '';
  private row: string[] = [];
  private bomSeen = false;
  private readonly maxBuffered = TABLE_IMPORT_CSV_MAX_BUFFER_UTF8_BYTES;

  pushChunk(chunk: Buffer): string[][] {
    let piece = this.dec.write(chunk);
    if (!this.bomSeen && piece.length > 0) {
      this.bomSeen = true;
      if (piece.charCodeAt(0) === 0xfeff) piece = piece.slice(1);
    }
    this.buf += piece;
    if (utf8ByteLength(this.buf) > this.maxBuffered) {
      throw new TableDatasheetValidationError('csv_line_too_long', 'CSV row or field is too long to parse safely.');
    }
    return this.consumeBuffer();
  }

  /** Call once after the byte stream ends. */
  end(): string[][] {
    let piece = this.dec.end();
    if (!this.bomSeen && piece.length > 0) {
      this.bomSeen = true;
      if (piece.charCodeAt(0) === 0xfeff) piece = piece.slice(1);
    }
    this.buf += piece;
    return this.consumeBuffer(true);
  }

  private consumeBuffer(isEnd = false): string[][] {
    const complete: string[][] = [];
    let i = 0;
    while (i < this.buf.length) {
      const c = this.buf[i];
      if (!this.inQuotes) {
        if (c === '\r') {
          this.endField();
          i++;
          if (i < this.buf.length && this.buf[i] === '\n') i++;
          complete.push(this.endRow());
          continue;
        }
        if (c === '\n') {
          this.endField();
          i++;
          complete.push(this.endRow());
          continue;
        }
        if (c === ',') {
          this.endField();
          i++;
          continue;
        }
        if (c === '"') {
          this.inQuotes = true;
          i++;
          continue;
        }
        this.field += c;
        i++;
      } else {
        if (c === '"') {
          if (i + 1 < this.buf.length && this.buf[i + 1] === '"') {
            this.field += '"';
            i += 2;
            continue;
          }
          this.inQuotes = false;
          i++;
          continue;
        }
        this.field += c;
        i++;
      }
    }
    this.buf = '';
    if (isEnd) {
      if (this.inQuotes) {
        throw new TableDatasheetValidationError('malformed_csv', 'CSV has an unclosed quoted field.');
      }
      if (this.field.length > 0 || this.row.length > 0) {
        this.endField();
        complete.push(this.endRow());
      }
    }
    return complete;
  }

  private endField(): void {
    this.row.push(this.field);
    this.field = '';
  }

  private endRow(): string[] {
    const r = this.row;
    this.row = [];
    return r;
  }
}

/**
 * Stream-parse CSV from binary chunks; validates limits incrementally and builds the final embedding string + row grid.
 * Retains the parsed row grid in memory (bounded by row count and total grid UTF-8 cap).
 */
export async function streamImportCsvDatasheet(
  source: AsyncIterable<Buffer | Uint8Array>,
  opts: CsvStreamImportOptions,
): Promise<CsvStreamImportResult> {
  const title = (opts.title ?? '').trim() || 'Table';
  const maxDataRows = Math.min(
    KNOWLEDGE_TABLE_MAX_ROWS,
    Math.max(1, Math.floor(opts.maxDataRows ?? KNOWLEDGE_TABLE_MAX_ROWS)),
  );
  const maxColumns = Math.min(
    KNOWLEDGE_TABLE_MAX_COLUMNS,
    Math.max(1, Math.floor(opts.maxColumns ?? KNOWLEDGE_TABLE_MAX_COLUMNS)),
  );
  const maxCellChars = Math.max(1, Math.floor(opts.maxCellChars ?? BOT_FIELD_MAX.knowledgeDatasheetCell));
  const maxGridUtf8Bytes = Math.min(
    KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES,
    Math.max(1024, Math.floor(opts.maxGridUtf8Bytes ?? KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES)),
  );
  const batchSize = Math.max(1, Math.floor(opts.batchSize ?? TABLE_IMPORT_CSV_BATCH_ROWS_DEFAULT));
  const maxSourceBytes =
    opts.maxSourceBytes != null && Number.isFinite(opts.maxSourceBytes)
      ? Math.max(1, Math.floor(opts.maxSourceBytes))
      : undefined;

  const parser = new CsvIncrementalParser();
  let sourceBytesRead = 0;
  let headerDone = false;
  let dropsDesc: number[] = [];
  let keepIdx: number[] = [];
  let columns: string[] = [];
  let expectedWidth = 0;
  let totalGridUtf8 = 0;
  const rows: string[][] = [];
  let nonEmptyRowCount = 0;
  let pendingBatch: string[][] = [];

  const gridBytesForRow = (r: string[]): number => {
    let n = 0;
    for (const c of r) n += utf8ByteLength(String(c ?? ''));
    return n;
  };

  const flushBatch = async () => {
    if (!opts.onDataRowBatch || pendingBatch.length === 0) return;
    await opts.onDataRowBatch(pendingBatch, { totalNonEmptyRows: nonEmptyRowCount });
    pendingBatch = [];
  };

  const handlePhysicalRows = async (physicalRows: string[][]) => {
    for (const cells of physicalRows) {
      if (!headerDone) {
        dropsDesc = sortUniqueDrops(opts.dropColumnIndices, cells.length);
        const h = headerCellsToColumns(cells, dropsDesc);
        columns = h.columns;
        keepIdx = h.keepIdx;
        expectedWidth = columns.length;
        if (expectedWidth === 0 || columns.every((c) => c.trim() === '')) {
          throw new TableDatasheetValidationError('no_headers', 'No column headers found.');
        }
        if (expectedWidth > maxColumns) {
          throw new TableDatasheetValidationError('too_many_columns', 'Too many columns for import.');
        }
        totalGridUtf8 = utf8ByteLength(title) + columns.reduce((a, c) => a + utf8ByteLength(c), 0);
        if (totalGridUtf8 > maxGridUtf8Bytes) {
          throw new TableDatasheetValidationError('grid_too_large', 'Datasheet exceeds maximum stored size.');
        }
        headerDone = true;
        continue;
      }

      const built = buildDataRowFromCells(cells, keepIdx, expectedWidth, maxCellChars);
      if (!built.some((x) => x.length > 0)) continue;

      const rowUtf8 = gridBytesForRow(built);
      if (totalGridUtf8 + rowUtf8 > maxGridUtf8Bytes) {
        throw new TableDatasheetValidationError('grid_too_large', 'Datasheet exceeds maximum stored size.');
      }

      nonEmptyRowCount += 1;
      if (nonEmptyRowCount > maxDataRows) {
        throw new TableDatasheetValidationError('too_many_rows', 'Too many rows for import.');
      }

      rows.push(built);
      totalGridUtf8 += rowUtf8;
      pendingBatch.push(built);
      if (pendingBatch.length >= batchSize) {
        await flushBatch();
      }
    }
  };

  for await (const chunk of source) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    sourceBytesRead += buf.length;
    if (maxSourceBytes != null && sourceBytesRead > maxSourceBytes) {
      throw new TableDatasheetValidationError(
        'csv_source_too_large',
        'This CSV file is too large to import. Split the file or remove unused rows, then try again.',
      );
    }
    const physical = parser.pushChunk(buf);
    await handlePhysicalRows(physical);
  }
  const endRows = parser.end();
  await handlePhysicalRows(endRows);
  await flushBatch();

  if (!headerDone) {
    throw new TableDatasheetValidationError('parse_error', 'Could not read CSV (empty file).');
  }
  if (rows.length === 0) {
    throw new TableDatasheetValidationError('header_only', 'No data rows found (header-only sheet).');
  }

  assertTableKnowledgeFitsMongoPersistOrThrow(title, columns, rows);

  const embeddingText = buildTableEmbeddingText(title, columns, rows);
  const gridUtf8Bytes = totalGridUtf8;

  return { columns, rows, embeddingText, gridUtf8Bytes, dataRowCount: nonEmptyRowCount };
}
