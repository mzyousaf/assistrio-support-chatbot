import { BadRequestException } from '@nestjs/common';
import type { OverviewDateRangeQuery } from './analytics-date-range.util';

export type AdminAnalyticsScope = 'all' | 'platform' | 'customer';

/** @deprecated Use {@link AdminAnalyticsScope} */
export type AdminBotsSummaryScope = AdminAnalyticsScope;

export type AdminAnalyticsScopeQuery = OverviewDateRangeQuery & {
  scope: AdminAnalyticsScope;
  customerId?: string;
};

/** @deprecated Use {@link AdminAnalyticsScopeQuery} */
export type AdminBotsSummaryQuery = AdminAnalyticsScopeQuery;

export type AdminAnalyticsScopeQueryInput = OverviewDateRangeQuery & {
  scope?: string;
  platformOnly?: string;
  customerId?: string;
};

/** @deprecated Use {@link AdminAnalyticsScopeQueryInput} */
export type AdminBotsSummaryQueryInput = AdminAnalyticsScopeQueryInput;

export function parseAdminAnalyticsScopeQuery(
  input: AdminAnalyticsScopeQueryInput,
): AdminAnalyticsScopeQuery {
  return parseAdminBotsSummaryQuery(input);
}

function parsePlatformOnly(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function parseScopeRaw(raw: string | undefined): AdminAnalyticsScope | undefined {
  const s = raw?.trim().toLowerCase();
  if (!s) return undefined;
  if (s === 'all' || s === 'platform' || s === 'customer') {
    return s;
  }
  throw new BadRequestException({
    error: 'Invalid scope. Use all, platform, or customer.',
    errorCode: 'INVALID_SCOPE',
  });
}

/**
 * Normalizes admin bots/summary query params. Default `scope` is `all` (unchanged list behavior).
 * `platformOnly=true` implies `scope=platform`. Non-empty `customerId` implies `scope=customer`.
 */
export function parseAdminBotsSummaryQuery(
  input: AdminAnalyticsScopeQueryInput,
): AdminAnalyticsScopeQuery {
  const customerId = input.customerId?.trim() || undefined;
  const platformOnly = parsePlatformOnly(input.platformOnly);
  const scopeFromParam = parseScopeRaw(input.scope);

  let scope: AdminAnalyticsScope = scopeFromParam ?? 'all';
  if (!scopeFromParam) {
    if (platformOnly) scope = 'platform';
    else if (customerId) scope = 'customer';
  }

  if (platformOnly && scope === 'customer') {
    throw new BadRequestException({
      error: 'platformOnly cannot be combined with customer scope.',
      errorCode: 'INVALID_SCOPE_COMBO',
    });
  }
  if (platformOnly) {
    scope = 'platform';
  }

  if (customerId && scope === 'platform') {
    throw new BadRequestException({
      error: 'customerId cannot be used with platform scope.',
      errorCode: 'INVALID_SCOPE_COMBO',
    });
  }

  if (customerId) {
    scope = 'customer';
  }

  return {
    from: input.from,
    to: input.to,
    scope,
    customerId,
  };
}
