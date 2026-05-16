import { describe, expect, it } from 'vitest';
import { formatCountDisplay, safeClientString, safeFiniteNumber } from './safeClientString';

describe('safeClientString', () => {
  it('returns fallback for non-strings', () => {
    expect(safeClientString(undefined)).toBe('—');
    expect(safeClientString({ x: 1 })).toBe('—');
  });

  it('trims and strips control chars', () => {
    expect(safeClientString('  hello\u0000 ')).toBe('hello');
  });
});

describe('safeFiniteNumber / formatCountDisplay', () => {
  it('parses finite numbers', () => {
    expect(safeFiniteNumber(3.2)).toBe(3.2);
    expect(safeFiniteNumber('4')).toBe(4);
    expect(safeFiniteNumber(NaN)).toBeNull();
  });

  it('formats counts', () => {
    expect(formatCountDisplay(12)).toBe('12');
    expect(formatCountDisplay('bad')).toBe('—');
  });
});
