import { resolveUsageLedgerPlanAtTime } from './usage-ledger-plan-at-time.util';
import type { WorkspaceEntitlementsService } from './workspace-entitlements.service';

describe('resolveUsageLedgerPlanAtTime', () => {
  function mockEntitlements(planKey: string, shouldReject = false) {
    return {
      resolveForWorkspace: shouldReject
        ? jest.fn().mockRejectedValue(new Error('resolver failed'))
        : jest.fn().mockResolvedValue({ planKey }),
    } as unknown as WorkspaceEntitlementsService;
  }

  it('returns entitlement planKey for valid workspace', async () => {
    const svc = mockEntitlements('starter');
    await expect(
      resolveUsageLedgerPlanAtTime(svc, '507f1f77bcf86cd799439011'),
    ).resolves.toBe('starter');
    expect(svc.resolveForWorkspace).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  it('falls back to free when resolver fails', async () => {
    const svc = mockEntitlements('pro', true);
    await expect(
      resolveUsageLedgerPlanAtTime(svc, '507f1f77bcf86cd799439011'),
    ).resolves.toBe('free');
  });

  it('falls back to free for missing or invalid workspace id', async () => {
    const svc = mockEntitlements('pro');
    await expect(resolveUsageLedgerPlanAtTime(svc, undefined)).resolves.toBe('free');
    await expect(resolveUsageLedgerPlanAtTime(svc, 'not-an-id')).resolves.toBe('free');
    expect(svc.resolveForWorkspace).not.toHaveBeenCalled();
  });
});
