import { Injectable } from '@nestjs/common';
import type { ParsedOverviewDateRange } from '../analytics/analytics-date-range.util';
import {
  clampIsoDateFromToAnalyticsHistory,
  clampParsedOverviewDateRangeToAnalyticsHistory,
  type AnalyticsHistoryWindowMetadata,
} from './analytics-entitlement-window.util';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';

export type { AnalyticsHistoryWindowMetadata } from './analytics-entitlement-window.util';

@Injectable()
export class WorkspaceAnalyticsEntitlementService {
  constructor(private readonly entitlementsService: WorkspaceEntitlementsService) {}

  async resolveAnalyticsHistoryDays(workspaceId: string): Promise<number | null> {
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    return entitlements.analyticsHistoryDays;
  }

  async clampParsedOverviewDateRange(
    workspaceId: string,
    parsed: ParsedOverviewDateRange,
  ): Promise<{ range: ParsedOverviewDateRange; window: AnalyticsHistoryWindowMetadata | null }> {
    const analyticsHistoryDays = await this.resolveAnalyticsHistoryDays(workspaceId);
    return clampParsedOverviewDateRangeToAnalyticsHistory(parsed, analyticsHistoryDays);
  }

  async clampListDateFrom(
    workspaceId: string,
    dateFrom: string | null | undefined,
  ): Promise<{ dateFrom: string | null; window: AnalyticsHistoryWindowMetadata | null }> {
    const analyticsHistoryDays = await this.resolveAnalyticsHistoryDays(workspaceId);
    return clampIsoDateFromToAnalyticsHistory(dateFrom, analyticsHistoryDays);
  }
}
