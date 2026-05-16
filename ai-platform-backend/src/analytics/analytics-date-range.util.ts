import { BadRequestException } from '@nestjs/common';

/** Default window when `from`/`to` query params are omitted. */
export const DEFAULT_OVERVIEW_RANGE_DAYS = 30;

/** Hard cap on range width to keep dashboard queries bounded. */
export const MAX_OVERVIEW_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

export type OverviewDateRangeQuery = {
  from?: string;
  to?: string;
};

export type ParsedOverviewDateRange = {
  from: Date;
  to: Date;
  /** Human-readable label for dashboards */
  label: string;
};

function parseIsoDate(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Parse `from` / `to` query strings (ISO 8601). Omitted → last {@link DEFAULT_OVERVIEW_RANGE_DAYS} days ending **now**.
 * Validates `from <= to` and max span {@link MAX_OVERVIEW_RANGE_MS}.
 */
export function parseOverviewDateRange(query: OverviewDateRangeQuery): ParsedOverviewDateRange {
  const now = new Date();
  const fromRaw = query.from?.trim();
  const toRaw = query.to?.trim();

  if (!fromRaw && !toRaw) {
    const from = new Date(now.getTime() - DEFAULT_OVERVIEW_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return {
      from,
      to: now,
      label: `Last ${DEFAULT_OVERVIEW_RANGE_DAYS} days`,
    };
  }

  if (toRaw && !fromRaw) {
    const to = parseIsoDate(toRaw);
    if (!to) {
      throw new BadRequestException({
        error: 'Invalid "to" date. Use ISO 8601 (e.g. 2026-01-15T00:00:00.000Z).',
        errorCode: 'INVALID_TO_DATE',
      });
    }
    const from = new Date(to.getTime() - DEFAULT_OVERVIEW_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return { from, to, label: `Ending ${to.toISOString().slice(0, 10)} (${DEFAULT_OVERVIEW_RANGE_DAYS} days prior)` };
  }

  if (fromRaw && !toRaw) {
    const from = parseIsoDate(fromRaw);
    if (!from) {
      throw new BadRequestException({
        error: 'Invalid "from" date. Use ISO 8601 (e.g. 2026-01-01T00:00:00.000Z).',
        errorCode: 'INVALID_FROM_DATE',
      });
    }
    return { from, to: now, label: `Since ${from.toISOString().slice(0, 10)}` };
  }

  const from = parseIsoDate(fromRaw!);
  const to = parseIsoDate(toRaw!);
  if (!from) {
    throw new BadRequestException({
      error: 'Invalid "from" date. Use ISO 8601 (e.g. 2026-01-01T00:00:00.000Z).',
      errorCode: 'INVALID_FROM_DATE',
    });
  }
  if (!to) {
    throw new BadRequestException({
      error: 'Invalid "to" date. Use ISO 8601 (e.g. 2026-01-15T00:00:00.000Z).',
      errorCode: 'INVALID_TO_DATE',
    });
  }

  let a = from;
  let b = to;
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }

  if (b.getTime() - a.getTime() > MAX_OVERVIEW_RANGE_MS) {
    throw new BadRequestException({
      error: `Date range exceeds maximum of ${MAX_OVERVIEW_RANGE_MS / (24 * 60 * 60 * 1000)} days.`,
      errorCode: 'DATE_RANGE_TOO_LARGE',
    });
  }

  return {
    from: a,
    to: b,
    label: 'Custom range',
  };
}
