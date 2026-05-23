import { Types } from 'mongoose';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import { WorkspaceSubscriptionsService } from './workspace-subscriptions.service';
import { megabytesToBytes } from './plan-catalog';

describe('WorkspaceEntitlementsService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function createService(subscription: Awaited<ReturnType<WorkspaceSubscriptionsService['findByWorkspaceId']>>) {
    const subscriptionsService = {
      findByWorkspaceId: jest.fn().mockResolvedValue(subscription),
    } as unknown as WorkspaceSubscriptionsService;

    return {
      service: new WorkspaceEntitlementsService(subscriptionsService),
      subscriptionsService,
    };
  }

  it('falls back to Free when subscription is missing', async () => {
    const { service } = createService(null);
    const entitlements = await service.resolveForWorkspace(workspaceId);

    expect(entitlements).toMatchObject({
      workspaceId,
      planKey: 'free',
      planName: 'Free',
      subscriptionStatus: 'free',
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 50,
      kbStorageMbPerBot: 10,
      kbStorageBytesPerBot: megabytesToBytes(10),
      maxKbStorageMbPerBot: 40,
      maxKbStorageBytesPerBot: megabytesToBytes(40),
      analyticsHistoryDays: 7,
      canExportReports: false,
      showPoweredByAssistrio: true,
      canRemoveBranding: false,
      activeAddons: [],
      topUpCreditsRemaining: 0,
    });
  });

  it('resolves Starter entitlements from subscription planKey', async () => {
    const { service } = createService({
      workspaceId: new Types.ObjectId(workspaceId),
      planKey: 'starter',
      status: 'active',
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-06-01'),
    });

    const entitlements = await service.resolveForWorkspace(workspaceId);

    expect(entitlements.planKey).toBe('starter');
    expect(entitlements.planName).toBe('Starter');
    expect(entitlements.subscriptionStatus).toBe('active');
    expect(entitlements.monthlyAiCredits).toBe(500);
    expect(entitlements.canExportReports).toBe(true);
    expect(entitlements.analyticsHistoryDays).toBeNull();
  });

  it('falls back to Free for invalid workspace id without throwing', async () => {
    const { service } = createService(null);
    const entitlements = await service.resolveForWorkspace('not-an-object-id');

    expect(entitlements.planKey).toBe('free');
    expect(entitlements.workspaceId).toBe('not-an-object-id');
  });
});
