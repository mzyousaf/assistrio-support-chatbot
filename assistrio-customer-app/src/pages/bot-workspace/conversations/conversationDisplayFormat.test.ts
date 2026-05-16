import { describe, expect, it } from 'vitest';
import { formatCompactNumber, formatCreditAmount, formatDurationSeconds } from './conversationDisplayFormat';

describe('formatDurationSeconds', () => {
  it('returns em dash for zero', () => {
    expect(formatDurationSeconds(0)).toBe('—');
  });

  it('formats minutes and seconds', () => {
    expect(formatDurationSeconds(75)).toBe('1m 15s');
  });
});

describe('formatCompactNumber', () => {
  it('formats integers without throwing', () => {
    const s = formatCompactNumber(1500);
    expect(Number(String(s).replace(/\D/g, ''))).toBe(1500);
  });
});

describe('formatCreditAmount', () => {
  it('uses singular credit for 1', () => {
    expect(formatCreditAmount(1)).toContain('1');
    expect(formatCreditAmount(1)).toContain('credit');
  });
});
