import { coerceNoteSnippetIndex } from './knowledge-note-snippet-index.util';

describe('coerceNoteSnippetIndex', () => {
  it('returns integer index for snippet kind', () => {
    expect(coerceNoteSnippetIndex({ kind: 'snippet', snippetIndex: 2 })).toBe(2);
  });

  it('truncates finite numbers', () => {
    expect(coerceNoteSnippetIndex({ kind: 'snippet', snippetIndex: 1.9 })).toBe(1);
  });

  it('parses numeric strings', () => {
    expect(coerceNoteSnippetIndex({ kind: 'snippet', snippetIndex: ' 4 ' })).toBe(4);
  });

  it('supports BSON-like objects with toNumber()', () => {
    expect(
      coerceNoteSnippetIndex({
        kind: 'snippet',
        snippetIndex: { toNumber: () => 3 },
      }),
    ).toBe(3);
  });

  it('allows legacy rows with missing kind when snippetIndex is present', () => {
    expect(coerceNoteSnippetIndex({ snippetIndex: 0 })).toBe(0);
  });

  it('returns undefined for general_note even if snippetIndex exists', () => {
    expect(coerceNoteSnippetIndex({ kind: 'general_note', snippetIndex: 1 })).toBeUndefined();
  });

  it('returns undefined for non-snippet kinds', () => {
    expect(coerceNoteSnippetIndex({ kind: 'other', snippetIndex: 1 })).toBeUndefined();
  });

  it('returns undefined for negative or non-finite indices', () => {
    expect(coerceNoteSnippetIndex({ kind: 'snippet', snippetIndex: -1 })).toBeUndefined();
    expect(coerceNoteSnippetIndex({ kind: 'snippet', snippetIndex: NaN })).toBeUndefined();
  });
});
