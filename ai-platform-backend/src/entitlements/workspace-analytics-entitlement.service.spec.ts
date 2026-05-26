import { clampParsedOverviewDateRangeToAnalyticsHistory } from './analytics-entitlement-window.util';
import type { AnalyticsHistoryWindowMetadata } from './analytics-entitlement-window.util';
import { WorkspaceAnalyticsEntitlementService } from './workspace-analytics-entitlement.service';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';

describe('WorkspaceAnalyticsEntitlementService', () => {
  const resolveForWorkspace = jest.fn();

  function makeSvc() {
    const entitlementsService = { resolveForWorkspace } as unknown as WorkspaceEntitlementsService;
    return new WorkspaceAnalyticsEntitlementService(entitlementsService);
  }

  beforeEach(() => {
    resolveForWorkspace.mockReset();
  });

  it('clamps parsed range for Free workspaces', async () => {
    resolveForWorkspace.mockResolvedValue({ analyticsHistoryDays: 7 });
    const svc = makeSvc();
    const now = new Date('2026-05-24T12:00:00.000Z');
    const parsed = {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: now,
      label: 'Custom range',
    };
    const out = await svc.clampParsedOverviewDateRange('ws-1', parsed);
    expect(out.window?.analyticsHistoryDays).toBe(7);
    expect(out.range.from.getTime()).toBeGreaterThan(parsed.from.getTime());
  });

  it('does not clamp Starter/Pro unlimited history', async () => {
    resolveForWorkspace.mockResolvedValue({ analyticsHistoryDays: null });
    const svc = makeSvc();
    const parsed = {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-05-24T12:00:00.000Z'),
      label: 'Custom range',
    };
    const out = await svc.clampParsedOverviewDateRange('ws-1', parsed);
    expect(out.range.from).toEqual(parsed.from);
    expect(out.window).toBeNull();
  });
});

describe('clampParsedOverviewDateRangeToAnalyticsHistory metadata', () => {
  it('includes effectiveFrom and requestedFrom when applied', () => {
    const now = new Date('2026-05-24T12:00:00.000Z');
    const requested = new Date('2026-01-01T00:00:00.000Z');
    const out = clampParsedOverviewDateRangeToAnalyticsHistory(
      { from: requested, to: now, label: 'Custom range' },
      7,
      now,
    );
    expect(out.window).toMatchObject({
      analyticsWindowApplied: true,
      analyticsHistoryDays: 7,
      requestedFrom: requested.toISOString(),
    });
    expect(out.window?.effectiveFrom).toBe(out.range.from.toISOString());
  });
});
