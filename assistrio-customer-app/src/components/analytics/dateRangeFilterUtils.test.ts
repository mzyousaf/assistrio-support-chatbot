import { describe, expect, it } from 'vitest';
import {
  computeDateRangePopoverPosition,
  countRangeDaysInclusive,
  customRangeDraftIsValid,
  dateRangeFromYmd,
  formatCustomRangeTriggerLabel,
  matchQuickRangeChipId,
  quickRangeLastDays,
  quickRangeToday,
  validateCustomRangeDraft,
  ymdFromDateRange,
} from './dateRangeFilterUtils';
import { localYmd } from '@/lib/chatsAnalyticsQuery';

describe('validateCustomRangeDraft', () => {
  it('requires both dates', () => {
    const result = validateCustomRangeDraft({ from: '', to: '' });
    expect(result.valid).toBe(false);
    expect(result.fromError).toBe('Start date is required.');
    expect(result.toError).toBe('End date is required.');
  });

  it('rejects end before start', () => {
    const result = validateCustomRangeDraft({
      from: '2024-02-01',
      to: '2024-01-01',
    });
    expect(result.valid).toBe(false);
    expect(result.toError).toBe('End date must be on or after start date.');
  });

  it('rejects future dates', () => {
    const future = localYmd(new Date(Date.now() + 86400000 * 5));
    const result = validateCustomRangeDraft({ from: future, to: future });
    expect(result.valid).toBe(false);
    expect(result.fromError).toBe('Start date cannot be in the future.');
    expect(result.toError).toBe('End date cannot be in the future.');
  });

  it('accepts valid range', () => {
    const result = validateCustomRangeDraft({
      from: '2024-01-01',
      to: '2024-01-31',
    });
    expect(result.valid).toBe(true);
  });
});

describe('dateRangeFromYmd', () => {
  it('round-trips ymd strings', () => {
    const range = dateRangeFromYmd('2024-01-05', '2024-01-20');
    expect(ymdFromDateRange(range)).toEqual({ from: '2024-01-05', to: '2024-01-20' });
  });

  it('returns undefined when both values are empty', () => {
    expect(dateRangeFromYmd('', '')).toBeUndefined();
  });
});

describe('formatCustomRangeTriggerLabel', () => {
  it('returns Custom range when incomplete', () => {
    expect(formatCustomRangeTriggerLabel('', '')).toBe('Custom range');
  });

  it('uses compact same-year label for current year', () => {
    const now = new Date('2026-01-15T12:00:00');
    expect(formatCustomRangeTriggerLabel('2026-01-01', '2026-01-15', now)).toBe('Jan 1 – Jan 15');
  });

  it('appends year for non-current same-year ranges', () => {
    expect(formatCustomRangeTriggerLabel('2024-01-01', '2024-01-15')).toBe('Jan 1 – Jan 15, 2024');
  });
});

describe('countRangeDaysInclusive', () => {
  it('counts inclusive days', () => {
    const range = dateRangeFromYmd('2026-01-01', '2026-01-15');
    expect(countRangeDaysInclusive(range)).toBe(15);
  });
});

describe('computeDateRangePopoverPosition', () => {
  it('aligns to trigger right edge when space allows', () => {
    const position = computeDateRangePopoverPosition(
      { top: 80, bottom: 112, left: 500, right: 620 },
      { width: 340, height: 420 },
      { width: 1280, height: 800 },
      { align: 'right', margin: 12, gap: 8 },
    );
    expect(position.left).toBe(280);
    expect(position.placement).toBe('below');
    expect(position.top).toBe(120);
  });

  it('flips above when there is not enough space below', () => {
    const position = computeDateRangePopoverPosition(
      { top: 680, bottom: 712, left: 200, right: 320 },
      { width: 340, height: 420 },
      { width: 1280, height: 800 },
      { align: 'right', margin: 12, gap: 8 },
    );
    expect(position.placement).toBe('above');
    expect(position.top).toBe(252);
  });

  it('clamps within viewport margins', () => {
    const position = computeDateRangePopoverPosition(
      { top: 80, bottom: 112, left: 0, right: 80 },
      { width: 340, height: 420 },
      { width: 400, height: 800 },
      { align: 'left', margin: 12, gap: 8 },
    );
    expect(position.left).toBe(12);
    expect(position.left + 340).toBeLessThanOrEqual(400 - 12);
  });
});

describe('matchQuickRangeChipId', () => {
  it('matches today chip', () => {
    const today = quickRangeToday();
    const range = dateRangeFromYmd(today.from, today.to);
    expect(matchQuickRangeChipId(range)).toBe('today');
  });

  it('matches 7d chip', () => {
    const draft = quickRangeLastDays(7);
    const range = dateRangeFromYmd(draft.from, draft.to);
    expect(matchQuickRangeChipId(range)).toBe('7d');
  });
});

describe('quick ranges', () => {
  it('today uses same start and end ymd', () => {
    const range = quickRangeToday();
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(customRangeDraftIsValid(range.from, range.to)).toBe(true);
  });

  it('last 7 days produces valid draft', () => {
    const range = quickRangeLastDays(7);
    expect(customRangeDraftIsValid(range.from, range.to)).toBe(true);
  });
});
