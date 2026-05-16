import {
  CsvIncrementalParser,
  streamImportCsvDatasheet,
} from './datasheet-csv-stream.util';
import { TableDatasheetValidationError } from './datasheet-import.util';
import { BOT_FIELD_MAX } from './shared/bot-field-limits';

async function chunksSource(chunks: Buffer[]): Promise<AsyncIterable<Buffer>> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

describe('streamImportCsvDatasheet', () => {
  it('invokes onDataRowBatch when rows exceed batch size', async () => {
    const batches: number[] = [];
    const header = 'C\n';
    const dataLines = Array.from({ length: 25 }, (_, i) => `${i + 1}\n`).join('');
    const csv = header + dataLines;
    const src = await chunksSource([Buffer.from(csv, 'utf8')]);
    await streamImportCsvDatasheet(src, {
      title: 'T',
      batchSize: 10,
      onDataRowBatch: async (_batch, st) => {
        batches.push(st.totalNonEmptyRows);
      },
    });
    expect(batches.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects too many data rows', async () => {
    const header = 'A\n';
    const lines = Array.from({ length: 5 }, () => 'x\n').join('');
    const src = await chunksSource([Buffer.from(header + lines, 'utf8')]);
    await expect(
      streamImportCsvDatasheet(src, {
        title: 'T',
        maxDataRows: 3,
      }),
    ).rejects.toMatchObject({ code: 'too_many_rows' });
  });

  it('rejects too many columns after header', async () => {
    const src = await chunksSource([Buffer.from('a,b,c,d\n1,2,3,4\n', 'utf8')]);
    await expect(
      streamImportCsvDatasheet(src, {
        title: 'T',
        maxColumns: 2,
      }),
    ).rejects.toMatchObject({ code: 'too_many_columns' });
  });

  it('rejects too-long cell (strict)', async () => {
    const long = 'z'.repeat(BOT_FIELD_MAX.knowledgeDatasheetCell + 5);
    const src = await chunksSource([Buffer.from(`A\n${long}\n`, 'utf8')]);
    await expect(
      streamImportCsvDatasheet(src, {
        title: 'T',
        maxCellChars: BOT_FIELD_MAX.knowledgeDatasheetCell,
      }),
    ).rejects.toMatchObject({ code: 'cell_too_long' });
  });

  it('rejects CSV stream larger than maxSourceBytes', async () => {
    const header = Buffer.from('A\n', 'utf8');
    const fat = Buffer.alloc(800, 120);
    const src = await chunksSource([header, fat]);
    await expect(
      streamImportCsvDatasheet(src, {
        title: 'T',
        maxSourceBytes: 500,
      }),
    ).rejects.toMatchObject({ code: 'csv_source_too_large' });
  });

  it('parses quoted multiline field across chunks', async () => {
    const part1 = Buffer.from('h1,h2\n"v', 'utf8');
    const part2 = Buffer.from('al\nue",x\n', 'utf8');
    const src = await chunksSource([part1, part2]);
    const r = await streamImportCsvDatasheet(src, { title: 'T' });
    expect(r.columns).toEqual(['h1', 'h2']);
    expect(r.rows).toEqual([['val\nue', 'x']]);
  });
});

describe('CsvIncrementalParser', () => {
  it('throws on unclosed quote at end', () => {
    const p = new CsvIncrementalParser();
    p.pushChunk(Buffer.from('a,"bc', 'utf8'));
    expect(() => p.end()).toThrow(TableDatasheetValidationError);
  });
});
