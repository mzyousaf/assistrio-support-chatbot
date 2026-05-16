import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASHEET_LOCKED_COLUMNS_LEAD, DATASHEET_LOCKED_COLUMNS_TITLE_HINT } from './datasheetEditCopy';

describe('datasheetEditCopy', () => {
  it('exports locked-column helper copy', () => {
    expect(DATASHEET_LOCKED_COLUMNS_LEAD).toMatch(/locked/i);
    expect(DATASHEET_LOCKED_COLUMNS_LEAD).toMatch(/add, edit, or delete rows/i);
    expect(DATASHEET_LOCKED_COLUMNS_TITLE_HINT).toMatch(/Columns are locked/i);
  });
});

describe('DatasheetEditPage column removal removed', () => {
  it('source does not contain post-import column delete UI', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, 'DatasheetEditPage.tsx'), 'utf8');
    expect(src).not.toContain('columnDeleteIndex');
    expect(src).not.toContain('confirmRemoveColumn');
    expect(src).not.toContain('Remove column?');
    expect(src).not.toContain('Remove column');
    expect(src).toContain('Add row');
    expect(src).toContain('data-datasheet-row-form');
  });
});
