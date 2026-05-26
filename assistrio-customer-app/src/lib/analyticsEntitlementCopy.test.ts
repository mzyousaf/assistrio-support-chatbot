import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_HISTORY_LOCKED_HELPER,
  EXPORT_REPORTS_LOCKED_HELPER,
  PLAN_LIMIT_EXPORT_REPORTS_MESSAGE,
  isAnalyticsHistoryLimited,
  resolveExportReportsSaveErrorMessage,
} from './analyticsEntitlementCopy';
import {
  filterAnalyticsDatePresetsForHistoryLimit,
  isAnalyticsDatePresetAllowed,
  minAnalyticsCustomFromYmd,
  shouldShowAnalyticsWindowClampedNote,
} from './analyticsEntitlementWindow';

describe('analyticsEntitlementCopy', () => {
  it('maps plan_limit_export_reports to friendly message', () => {
    expect(
      resolveExportReportsSaveErrorMessage({
        errorCode: 'plan_limit_export_reports',
        error: 'Exporting reports requires the Starter plan or higher.',
      }),
    ).toBe(PLAN_LIMIT_EXPORT_REPORTS_MESSAGE);
  });

  it('detects limited analytics history', () => {
    expect(isAnalyticsHistoryLimited(7)).toBe(true);
    expect(isAnalyticsHistoryLimited(null)).toBe(false);
  });

  it('exports helper copy', () => {
    expect(ANALYTICS_HISTORY_LOCKED_HELPER).toContain('7 days');
    expect(EXPORT_REPORTS_LOCKED_HELPER).toContain('Starter');
  });
});

describe('analyticsEntitlementWindow', () => {
  it('disables long presets on Free plan', () => {
    const options = filterAnalyticsDatePresetsForHistoryLimit(
      [
        { id: '7d', label: 'Last 7 days' },
        { id: '30d', label: 'Last 30 days' },
      ],
      7,
    );
    expect(options.find((o) => o.id === '30d')?.disabled).toBe(true);
    expect(options.find((o) => o.id === '7d')?.disabled).not.toBe(true);
  });

  it('allows all presets when history is unlimited', () => {
    expect(isAnalyticsDatePresetAllowed('90d', null)).toBe(true);
  });

  it('provides custom min date for Free', () => {
    expect(minAnalyticsCustomFromYmd(7)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('shows clamp note when backend applied window', () => {
    expect(
      shouldShowAnalyticsWindowClampedNote({
        analyticsWindowApplied: true,
        analyticsHistoryDays: 7,
        effectiveFrom: '2026-05-17T00:00:00.000Z',
      }),
    ).toBe(true);
  });
});
