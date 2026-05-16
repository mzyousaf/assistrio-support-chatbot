import { HttpException } from '@nestjs/common';
import {
  assertDatasheetColumnsUnchangedIfLocked,
  datasheetColumnHeadersEqual,
  datasheetColumnsLockedFromTableMeta,
  DATASHEET_COLUMNS_LOCKED_CODE,
  parseTableColumnsFromRawContent,
} from './datasheet-columns-locked.util';

describe('datasheet-columns-locked.util', () => {
  it('datasheetColumnsLockedFromTableMeta: true when importPhase complete', () => {
    expect(datasheetColumnsLockedFromTableMeta({ importPhase: 'complete' })).toBe(true);
  });

  it('datasheetColumnsLockedFromTableMeta: true when importedAt set', () => {
    expect(datasheetColumnsLockedFromTableMeta({ importedAt: new Date() })).toBe(true);
  });

  it('datasheetColumnsLockedFromTableMeta: false when import queued', () => {
    expect(
      datasheetColumnsLockedFromTableMeta({
        importPhase: 'import_queued',
        importFileName: 'x.csv',
      }),
    ).toBe(false);
  });

  it('datasheetColumnHeadersEqual: detects rename, reorder, add, remove', () => {
    expect(datasheetColumnHeadersEqual(['A', 'B'], ['A', 'B'])).toBe(true);
    expect(datasheetColumnHeadersEqual(['A', 'B'], ['a', 'b'])).toBe(false);
    expect(datasheetColumnHeadersEqual(['A', 'B'], ['B', 'A'])).toBe(false);
    expect(datasheetColumnHeadersEqual(['A'], ['A', 'B'])).toBe(false);
    expect(datasheetColumnHeadersEqual(['A', 'B'], ['A'])).toBe(false);
    expect(datasheetColumnHeadersEqual(['A', 'B'], ['A', 'C'])).toBe(false);
  });

  it('parseTableColumnsFromRawContent', () => {
    expect(
      parseTableColumnsFromRawContent(JSON.stringify({ title: 't', columns: ['a', 'b'], rows: [] })),
    ).toEqual(['a', 'b']);
    expect(parseTableColumnsFromRawContent('')).toBe(null);
  });

  it('assertDatasheetColumnsUnchangedIfLocked throws when locked and columns change', () => {
    expect(() =>
      assertDatasheetColumnsUnchangedIfLocked({
        tableMeta: { importPhase: 'complete' },
        rawContent: JSON.stringify({ columns: ['A', 'B'], rows: [] }),
        incomingColumns: ['A', 'C'],
      }),
    ).toThrow(HttpException);

    try {
      assertDatasheetColumnsUnchangedIfLocked({
        tableMeta: { importPhase: 'complete' },
        rawContent: JSON.stringify({ columns: ['A', 'B'], rows: [] }),
        incomingColumns: ['A', 'C'],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      const r = (e as HttpException).getResponse() as { errorCode?: string };
      expect(r.errorCode).toBe(DATASHEET_COLUMNS_LOCKED_CODE);
    }
  });

  it('assertDatasheetColumnsUnchangedIfLocked allows row-only updates when locked', () => {
    expect(() =>
      assertDatasheetColumnsUnchangedIfLocked({
        tableMeta: { importPhase: 'complete' },
        rawContent: JSON.stringify({ columns: ['A', 'B'], rows: [['1', '2']] }),
        incomingColumns: ['A', 'B'],
      }),
    ).not.toThrow();
  });

  it('assertDatasheetColumnsUnchangedIfLocked: not locked → no throw on column change', () => {
    expect(() =>
      assertDatasheetColumnsUnchangedIfLocked({
        tableMeta: { tableIndex: 0 },
        rawContent: JSON.stringify({ columns: ['A'], rows: [] }),
        incomingColumns: ['B'],
      }),
    ).not.toThrow();
  });
});
