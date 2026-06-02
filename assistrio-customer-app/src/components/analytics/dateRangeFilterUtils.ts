import type { DateRange } from '@daypicker/react';
import { isoRangeForToday, localYmd } from '@/lib/chatsAnalyticsQuery';
import { customYmdRangeIsValid } from '@/lib/analyticsQueryDates';

export type CustomRangeDraft = {
  from: string;
  to: string;
};

export type QuickRangeChipId = 'today' | '7d' | '30d' | '90d';

export type PopoverPlacement = 'below' | 'above';

export type PopoverPosition = {
  top: number;
  left: number;
  placement: PopoverPlacement;
};

const VIEWPORT_MARGIN_DEFAULT = 12;
const POPOVER_GAP_DEFAULT = 8;

export function ymdToLocalDate(ymd: string): Date | undefined {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined;
  const d = new Date(`${t}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

export function dateToYmd(date: Date): string {
  return localYmd(date);
}

export function dateRangeFromYmd(from?: string, to?: string): DateRange | undefined {
  const fromDate = from?.trim() ? ymdToLocalDate(from) : undefined;
  const toDate = to?.trim() ? ymdToLocalDate(to) : undefined;
  if (!fromDate && !toDate) return undefined;
  return { from: fromDate, to: toDate };
}

export function ymdFromDateRange(range: DateRange | undefined): { from: string; to: string } {
  return {
    from: range?.from ? dateToYmd(range.from) : '',
    to: range?.to ? dateToYmd(range.to) : '',
  };
}

export function customRangeDraftFromYmd(from?: string, to?: string): CustomRangeDraft {
  return { from: from?.trim() ?? '', to: to?.trim() ?? '' };
}

export function seedDefaultCustomRange(days = 30): CustomRangeDraft {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  return { from: localYmd(from), to: localYmd(to) };
}

export function seedDefaultDraftRange(days = 30): DateRange {
  const { from, to } = seedDefaultCustomRange(days);
  return dateRangeFromYmd(from, to)!;
}

export function quickRangeToday(): CustomRangeDraft {
  const { from, to } = isoRangeForToday();
  return {
    from: localYmd(new Date(from)),
    to: localYmd(new Date(to)),
  };
}

export function quickRangeLastDays(days: number): CustomRangeDraft {
  return seedDefaultCustomRange(days);
}

export function quickRangeDraftToDateRange(draft: CustomRangeDraft): DateRange | undefined {
  return dateRangeFromYmd(draft.from, draft.to);
}

export function matchQuickRangeChipId(
  range: DateRange | undefined,
  now: Date = new Date(),
): QuickRangeChipId | null {
  if (!range?.from || !range?.to) return null;
  const { from, to } = ymdFromDateRange(range);
  if (!customRangeDraftIsValid(from, to)) return null;

  const today = quickRangeToday();
  if (from === today.from && to === today.to) return 'today';

  for (const id of ['7d', '30d', '90d'] as const) {
    const days = id === '7d' ? 7 : id === '30d' ? 30 : 90;
    const expected = quickRangeLastDays(days);
    if (from === expected.from && to === expected.to) return id;
  }

  void now;
  return null;
}

export function customRangeDraftIsValid(from: string, to: string): boolean {
  return Boolean(from.trim() && to.trim() && customYmdRangeIsValid(from, to));
}

export function customRangeIsValid(range: DateRange | undefined): boolean {
  const { from, to } = ymdFromDateRange(range);
  return customRangeDraftIsValid(from, to);
}

export function formatCustomRangeSummaryYmd(ymd: string): string {
  const d = ymdToLocalDate(ymd);
  if (!d) return ymd;
  try {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return ymd;
  }
}

export function formatCustomRangeTriggerLabel(
  fromYmd: string,
  toYmd: string,
  now: Date = new Date(),
): string {
  if (!customRangeDraftIsValid(fromYmd, toYmd)) return 'Custom range';

  const from = ymdToLocalDate(fromYmd)!;
  const to = ymdToLocalDate(toYmd)!;
  const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const currentYear = now.getFullYear();

  if (from.getFullYear() === to.getFullYear()) {
    const base = `${short(from)} – ${short(to)}`;
    if (from.getFullYear() === currentYear) return base;
    return `${base}, ${from.getFullYear()}`;
  }

  return `${short(from)}, ${from.getFullYear()} – ${short(to)}, ${to.getFullYear()}`;
}

export function countRangeDaysInclusive(range: DateRange | undefined): number {
  if (!range?.from || !range?.to) return 0;
  const fromYmd = dateToYmd(range.from);
  const toYmd = dateToYmd(range.to);
  const from = ymdToLocalDate(fromYmd);
  const to = ymdToLocalDate(toYmd);
  if (!from || !to) return 0;
  const diff = Math.round((to.getTime() - from.getTime()) / 86400000);
  return diff >= 0 ? diff + 1 : 0;
}

export function computeDateRangePopoverPosition(
  triggerRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>,
  popoverSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
  options?: { align?: 'left' | 'right'; margin?: number; gap?: number },
): PopoverPosition {
  const margin = options?.margin ?? VIEWPORT_MARGIN_DEFAULT;
  const gap = options?.gap ?? POPOVER_GAP_DEFAULT;
  const align = options?.align ?? 'right';
  const maxLeft = Math.max(margin, viewportSize.width - popoverSize.width - margin);

  let left =
    align === 'right'
      ? triggerRect.right - popoverSize.width
      : triggerRect.left;

  left = Math.min(Math.max(left, margin), maxLeft);

  if (left + popoverSize.width > viewportSize.width - margin) {
    left = Math.max(margin, triggerRect.left - popoverSize.width);
    left = Math.min(Math.max(left, margin), maxLeft);
  }

  const belowTop = triggerRect.bottom + gap;
  const aboveTop = triggerRect.top - popoverSize.height - gap;
  const fitsBelow = belowTop + popoverSize.height <= viewportSize.height - margin;
  const fitsAbove = aboveTop >= margin;

  if (fitsBelow || !fitsAbove) {
    return {
      top: Math.min(belowTop, Math.max(margin, viewportSize.height - popoverSize.height - margin)),
      left,
      placement: 'below',
    };
  }

  return {
    top: Math.max(margin, aboveTop),
    left,
    placement: 'above',
  };
}

export function isYmdFormat(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function isFutureYmd(ymd: string, now: Date = new Date()): boolean {
  const d = ymdToLocalDate(ymd);
  if (!d) return false;
  const today = localYmd(now);
  return ymd.trim() > today;
}

export type CustomRangeValidationResult = {
  valid: boolean;
  fromError?: string;
  toError?: string;
};

export function validateCustomRangeDraft(
  draft: CustomRangeDraft,
  options?: { minFromYmd?: string | null; disableFutureDates?: boolean },
): CustomRangeValidationResult {
  const from = draft.from.trim();
  const to = draft.to.trim();
  const disableFuture = options?.disableFutureDates !== false;
  const minFrom = options?.minFromYmd?.trim() ?? '';

  let fromError: string | undefined;
  let toError: string | undefined;

  if (!from) {
    fromError = 'Start date is required.';
  } else if (!isYmdFormat(from)) {
    fromError = 'Use YYYY-MM-DD format.';
  } else if (disableFuture && isFutureYmd(from)) {
    fromError = 'Start date cannot be in the future.';
  } else if (minFrom && from < minFrom) {
    fromError = 'Start date is outside your plan history window.';
  }

  if (!to) {
    toError = 'End date is required.';
  } else if (!isYmdFormat(to)) {
    toError = 'Use YYYY-MM-DD format.';
  } else if (disableFuture && isFutureYmd(to)) {
    toError = 'End date cannot be in the future.';
  }

  if (!fromError && !toError && from && to && isYmdFormat(from) && isYmdFormat(to)) {
    if (!customYmdRangeIsValid(from, to)) {
      toError = 'End date must be on or after start date.';
    }
  }

  return {
    valid: !fromError && !toError,
    fromError,
    toError,
  };
}

export function startOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}
