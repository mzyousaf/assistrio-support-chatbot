import { BadRequestException } from '@nestjs/common';
import type { ParsedWorkspaceUsageAnalyticsQuery } from './workspace-usage-analytics.types';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseUtcYmd(value: string): Date | null {
  const trimmed = value.trim();
  if (!YMD_RE.test(trimmed)) return null;
  const d = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function utcYmdFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function enumerateUtcDaysInclusive(startYmd: string, endYmd: string): string[] {
  const start = parseUtcYmd(startYmd);
  const end = parseUtcYmd(endYmd);
  if (!start || !end || start > end) return [];

  const days: string[] = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    days.push(utcYmdFromDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function utcDayBounds(startYmd: string, endYmd: string): { start: Date; end: Date } | null {
  const start = parseUtcYmd(startYmd);
  const end = parseUtcYmd(endYmd);
  if (!start || !end || start > end) return null;
  return {
    start,
    end: new Date(`${endYmd.trim()}T23:59:59.999Z`),
  };
}

export function allocateCreditsToPools(
  creditsUsed: number,
  monthlyRemainingInPeriod: number,
): { monthlyCreditsUsed: number; topUpCreditsUsed: number } {
  const credits = Math.max(0, creditsUsed);
  const monthlyRoom = Math.max(0, monthlyRemainingInPeriod);
  const monthlyCreditsUsed = Math.min(credits, monthlyRoom);
  const topUpCreditsUsed = credits - monthlyCreditsUsed;
  return { monthlyCreditsUsed, topUpCreditsUsed };
}

export function billingPeriodKey(start: Date | null | undefined, end: Date | null | undefined): string {
  const s = start instanceof Date && !Number.isNaN(start.getTime()) ? start.toISOString() : 'unknown-start';
  const e = end instanceof Date && !Number.isNaN(end.getTime()) ? end.toISOString() : 'unknown-end';
  return `${s}|${e}`;
}

export function defaultUsageAnalyticsDateRange(now: Date = new Date()): { startDate: string; endDate: string } {
  const endDate = utcYmdFromDate(now);
  const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  return { startDate: utcYmdFromDate(start), endDate };
}

export function clampUsageAnalyticsStartDate(
  startYmd: string,
  endYmd: string,
  maxHistoryDays: number | null | undefined,
  now: Date = new Date(),
): string {
  if (maxHistoryDays == null || !Number.isFinite(maxHistoryDays) || maxHistoryDays <= 0) {
    return startYmd;
  }
  const earliest = new Date(now.getTime() - Math.floor(maxHistoryDays) * 24 * 60 * 60 * 1000);
  const earliestYmd = utcYmdFromDate(earliest);
  return startYmd < earliestYmd ? earliestYmd : startYmd;
}

export function parseWorkspaceUsageAnalyticsQuery(input: {
  startDate?: string;
  endDate?: string;
  botIds?: string;
}): ParsedWorkspaceUsageAnalyticsQuery {
  const fallback = defaultUsageAnalyticsDateRange();
  const startRaw = input.startDate?.trim() || fallback.startDate;
  const endRaw = input.endDate?.trim() || fallback.endDate;

  if (!parseUtcYmd(startRaw) || !parseUtcYmd(endRaw)) {
    throw new BadRequestException({ error: 'Invalid startDate or endDate. Use YYYY-MM-DD.' });
  }
  if (startRaw > endRaw) {
    throw new BadRequestException({ error: 'startDate must be on or before endDate.' });
  }

  const botIds = (input.botIds ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return { startDate: startRaw, endDate: endRaw, botIds };
}
