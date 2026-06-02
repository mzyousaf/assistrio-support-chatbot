import { Types } from 'mongoose';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import { WorkspaceSubscriptionsService } from './workspace-subscriptions.service';
import { megabytesToBytes } from './plan-catalog';

describe('WorkspaceEntitlementsService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function createService(
    subscription: Awaited<ReturnType<WorkspaceSubscriptionsService['findByWorkspaceId']>>,
    options: {
      addons?: Array<{ addonKey: string; targetBotId?: Types.ObjectId | null; status: string }>;
      topUpRemaining?: number;
    } = {},
  ) {
    const subscriptionsService = {
      findByWorkspaceId: jest.fn().mockResolvedValue(subscription),
      applyPendingScheduledPlanChanges: jest.fn().mockImplementation(async () => subscription),
    } as unknown as WorkspaceSubscriptionsService;

    const memberOverLimitReconcileService = {
      reconcileIfNeeded: jest.fn().mockResolvedValue(null),
    };

    const topUpService = {
      sumRemainingCredits: jest.fn().mockResolvedValue(options.topUpRemaining ?? 0),
    };

    const addonModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(options.addons ?? []),
          }),
        }),
      }),
    };

    return {
      service: new WorkspaceEntitlementsService(
        subscriptionsService,
        topUpService as never,
        addonModel as never,
        memberOverLimitReconcileService as never,
      ),
      subscriptionsService,
      topUpService,
      addonModel,
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
      memberLimit: 1,
      monthlyAiCredits: 50,
      kbStorageMbPerBot: 5,
      kbStorageBytesPerBot: megabytesToBytes(5),
      maxKbStorageMbPerBot: 40,
      maxKbStorageBytesPerBot: megabytesToBytes(40),
      analyticsHistoryDays: 7,
      canExportReports: false,
      showPoweredByAssistrio: true,
      isTrialPlan: true,
      trialDays: 7,
      creditsRenewMonthly: false,
      autoTrainAllowed: false,
      addonsAllowed: false,
      memberInvitesAllowed: false,
      canRemoveBranding: false,
      activeAddons: [],
      topUpCreditsRemaining: 0,
      kbStorageBonusMbByBotId: {},
    });
  });

  it('resolves free trial dates and expiry from subscription period', async () => {
    const trialStart = new Date('2026-06-01T00:00:00.000Z');
    const trialEnd = new Date('2026-06-08T00:00:00.000Z');
    const { service } = createService({
      workspaceId: new Types.ObjectId(workspaceId),
      planKey: 'free',
      status: 'trialing',
      currentPeriodStart: trialStart,
      currentPeriodEnd: trialEnd,
    });

    const entitlements = await service.resolveForWorkspace(workspaceId);

    expect(entitlements.trialStartedAt).toBe(trialStart.toISOString());
    expect(entitlements.trialEndsAt).toBe(trialEnd.toISOString());
    expect(entitlements.isTrialExpired).toBe(false);
  });

  it('paid Starter clears trial expired and enables paid flags', async () => {
    const { service } = createService({
      workspaceId: new Types.ObjectId(workspaceId),
      planKey: 'starter',
      status: 'active',
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-06-01'),
    });

    const entitlements = await service.resolveForWorkspace(workspaceId);

    expect(entitlements.isTrialPlan).toBe(false);
    expect(entitlements.isTrialExpired).toBe(false);
    expect(entitlements.autoTrainAllowed).toBe(true);
    expect(entitlements.addonsAllowed).toBe(true);
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
    expect(entitlements.memberLimit).toBe(5);
    expect(entitlements.monthlyAiCredits).toBe(500);
    expect(entitlements.kbStorageMbPerBot).toBe(15);
    expect(entitlements.autoTrainAllowed).toBe(true);
    expect(entitlements.memberInvitesAllowed).toBe(true);
    expect(entitlements.creditsRenewMonthly).toBe(true);
  });

  it('resolves Pro entitlements including 30 MB trained KB storage', async () => {
    const { service } = createService({
      workspaceId: new Types.ObjectId(workspaceId),
      planKey: 'pro',
      status: 'active',
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-06-01'),
    });

    const entitlements = await service.resolveForWorkspace(workspaceId);

    expect(entitlements.planKey).toBe('pro');
    expect(entitlements.memberLimit).toBe(10);
    expect(entitlements.monthlyAiCredits).toBe(2000);
    expect(entitlements.kbStorageMbPerBot).toBe(30);
    expect(entitlements.kbStorageBytesPerBot).toBe(megabytesToBytes(30));
    expect(entitlements.maxKbStorageBytesPerBot).toBe(megabytesToBytes(40));
  });

  it('applies extra_bot and remove_branding add-ons', async () => {
    const { service } = createService(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        planKey: 'starter',
        status: 'active',
        currentPeriodStart: new Date('2026-05-01'),
        currentPeriodEnd: new Date('2026-06-01'),
      },
      {
        addons: [
          { addonKey: 'extra_bot', status: 'active' },
          { addonKey: 'remove_branding', status: 'active' },
        ],
      },
    );

    const entitlements = await service.resolveForWorkspace(workspaceId);

    expect(entitlements.botLimit).toBe(2);
    expect(entitlements.canRemoveBranding).toBe(true);
    expect(entitlements.activeAddons).toEqual(
      expect.arrayContaining(['extra_bot', 'remove_branding']),
    );
  });

  it('includes top-up credits remaining', async () => {
    const { service } = createService(
      {
        workspaceId: new Types.ObjectId(workspaceId),
        planKey: 'starter',
        status: 'active',
        currentPeriodStart: new Date('2026-05-01'),
        currentPeriodEnd: new Date('2026-06-01'),
      },
      { topUpRemaining: 750 },
    );

    const entitlements = await service.resolveForWorkspace(workspaceId);
    expect(entitlements.topUpCreditsRemaining).toBe(750);
  });

  it('keeps Pro entitlements before scheduled downgrade effective date', async () => {
    const { service } = createService({
      workspaceId: new Types.ObjectId(workspaceId),
      planKey: 'pro',
      status: 'active',
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-07-01'),
      scheduledPlanChange: {
        fromPlanKey: 'pro',
        toPlanKey: 'starter',
        effectiveAt: new Date('2026-07-01'),
        status: 'scheduled',
      },
    });

    const entitlements = await service.resolveForWorkspace(
      workspaceId,
      new Date('2026-06-15'),
    );

    expect(entitlements.planKey).toBe('pro');
    expect(entitlements.monthlyAiCredits).toBe(2000);
    expect(entitlements.memberLimit).toBe(10);
  });

  it('falls back to free expired after canceled paid subscription', async () => {
    const { service } = createService({
      workspaceId: new Types.ObjectId(workspaceId),
      planKey: 'pro',
      status: 'canceled',
      currentPeriodStart: new Date('2025-12-01'),
      currentPeriodEnd: new Date('2026-01-01'),
    });

    const entitlements = await service.resolveForWorkspace(
      workspaceId,
      new Date('2026-06-15'),
    );

    expect(entitlements.planKey).toBe('free');
    expect(entitlements.isTrialExpired).toBe(true);
    expect(entitlements.monthlyAiCredits).toBe(50);
    expect(entitlements.sharePreviewAllowed).toBe(false);
  });

  it('allows share preview on Starter with past_due status', async () => {
    const { service } = createService({
      workspaceId: new Types.ObjectId(workspaceId),
      planKey: 'starter',
      status: 'past_due',
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-06-01'),
    });

    const entitlements = await service.resolveForWorkspace(workspaceId);
    expect(entitlements.planKey).toBe('starter');
    expect(entitlements.sharePreviewAllowed).toBe(true);
  });

  it('allows share preview during cancel-at-period-end grace', async () => {
    const { service } = createService({
      workspaceId: new Types.ObjectId(workspaceId),
      planKey: 'starter',
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-07-01'),
    });

    const entitlements = await service.resolveForWorkspace(workspaceId, new Date('2026-06-15'));
    expect(entitlements.planKey).toBe('starter');
    expect(entitlements.sharePreviewAllowed).toBe(true);
  });

  it('blocks share preview on free trial', async () => {
    const { service } = createService({
      workspaceId: new Types.ObjectId(workspaceId),
      planKey: 'free',
      status: 'trialing',
      currentPeriodStart: new Date('2026-06-01'),
      currentPeriodEnd: new Date('2026-06-08'),
    });

    const entitlements = await service.resolveForWorkspace(workspaceId);
    expect(entitlements.sharePreviewAllowed).toBe(false);
  });

  it('allows share preview on active Pro', async () => {
    const { service } = createService({
      workspaceId: new Types.ObjectId(workspaceId),
      planKey: 'pro',
      status: 'active',
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-06-01'),
    });

    const entitlements = await service.resolveForWorkspace(workspaceId);
    expect(entitlements.sharePreviewAllowed).toBe(true);
  });

  it('falls back to Free for invalid workspace id without throwing', async () => {
    const { service } = createService(null);
    const entitlements = await service.resolveForWorkspace('not-an-object-id');

    expect(entitlements.planKey).toBe('free');
    expect(entitlements.workspaceId).toBe('not-an-object-id');
  });
});
