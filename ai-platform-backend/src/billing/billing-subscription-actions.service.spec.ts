import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BillingSubscriptionActionsService } from './billing-subscription-actions.service';
import { BillingProviderActionError } from './billing-provider.types';
import { BillingProviderService } from './billing-provider.service';
import { WorkspaceSubscriptionsService } from '../entitlements/workspace-subscriptions.service';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { BillingWebhookProcessingService } from './billing-webhook-processing.service';
import { BillingWorkspacePaymentNotificationService } from './billing-workspace-payment-notification.service';

describe('BillingSubscriptionActionsService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function buildSubscription(overrides?: Record<string, unknown>) {
    return {
      planKey: 'pro',
      status: 'active',
      provider: 'lemon_squeezy',
      providerSubscriptionId: 'sub-1',
      currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      ...overrides,
    };
  }

  function buildService(overrides?: {
    subscription?: Record<string, unknown> | null;
    entitlements?: Record<string, unknown>;
    cancelRemote?: Record<string, unknown>;
    changeRemote?: Record<string, unknown>;
    reloadSubscription?: Record<string, unknown> | null;
  }) {
    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      cancelSubscription: jest.fn().mockResolvedValue(
        overrides?.cancelRemote ?? {
          status: 'active',
          cancelAtPeriodEnd: true,
          planKey: 'starter',
          currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
        },
      ),
      changeSubscriptionPlan: jest.fn().mockResolvedValue(
        overrides?.changeRemote ?? {
          status: 'active',
          planKey: 'starter',
          providerVariantId: '111',
          currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
        },
      ),
      restoreSubscription: jest.fn().mockResolvedValue({
        status: 'active',
        planKey: 'pro',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
      }),
    };

    const initialSubscription = overrides?.subscription ?? buildSubscription();
    const reloadSubscription =
      overrides?.reloadSubscription ??
      buildSubscription({
        cancelAtPeriodEnd: true,
        planKey: 'starter',
      });

    const subscriptionsService = {
      findByWorkspaceId: jest.fn().mockImplementation(async () => {
        const callCount = subscriptionsService.findByWorkspaceId.mock.calls.length;
        if (callCount <= 1) {
          return initialSubscription;
        }
        return reloadSubscription;
      }),
    };

    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue({
        planKey: 'pro',
        isTrialPlan: false,
        addonsAllowed: true,
        ...overrides?.entitlements,
      }),
    };
    const webhookProcessingService = {
      applyAction: jest.fn().mockResolvedValue(undefined),
    };
    const paymentNotificationService = {
      notifySubscriptionCancelScheduled: jest.fn().mockResolvedValue(undefined),
      notifySubscriptionRestored: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BillingSubscriptionActionsService(
      billingProviderService as never,
      subscriptionsService as never,
      entitlementsService as never,
      webhookProcessingService as never,
      paymentNotificationService as never,
    );

    return {
      service,
      billingProviderService,
      subscriptionsService,
      entitlementsService,
      webhookProcessingService,
      paymentNotificationService,
    };
  }

  it('resolves via Nest TestingModule without WorkspaceBillingSummaryService', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingSubscriptionActionsService,
        { provide: BillingProviderService, useValue: { isCheckoutConfigured: () => true } },
        { provide: WorkspaceSubscriptionsService, useValue: {} },
        { provide: WorkspaceEntitlementsService, useValue: {} },
        { provide: BillingWebhookProcessingService, useValue: {} },
        { provide: BillingWorkspacePaymentNotificationService, useValue: {} },
      ],
    }).compile();

    expect(moduleRef.get(BillingSubscriptionActionsService)).toBeInstanceOf(
      BillingSubscriptionActionsService,
    );
  });

  it('owner can cancel active paid subscription when confirmed', async () => {
    const { service, billingProviderService, webhookProcessingService } = buildService();

    const result = await service.cancelSubscription(workspaceId, true);

    expect(billingProviderService.cancelSubscription).toHaveBeenCalledWith({
      providerSubscriptionId: 'sub-1',
    });
    expect(webhookProcessingService.applyAction).toHaveBeenCalled();
    expect(result.action).toBe('cancel');
    expect(result.ok).toBe(true);
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.message).toContain('cancellation scheduled');
  });

  it('requires confirm=true to cancel', async () => {
    const { service } = buildService();
    await expect(service.cancelSubscription(workspaceId, false)).rejects.toMatchObject({
      response: { errorCode: 'billing_cancel_confirmation_required' },
    });
  });

  it('blocks cancel without active paid subscription', async () => {
    const { service } = buildService({
      subscription: {
        planKey: 'free',
        status: 'free',
        provider: null,
        providerSubscriptionId: null,
      },
    });
    await expect(service.cancelSubscription(workspaceId, true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('owner can downgrade Pro to Starter immediately', async () => {
    const { service, billingProviderService } = buildService({
      entitlements: { planKey: 'pro', isTrialPlan: false },
      reloadSubscription: buildSubscription({ planKey: 'starter', cancelAtPeriodEnd: false }),
    });

    const result = await service.changePlan(workspaceId, 'starter');

    expect(billingProviderService.changeSubscriptionPlan).toHaveBeenCalledWith({
      providerSubscriptionId: 'sub-1',
      planKey: 'starter',
      disableProrations: true,
    });
    expect(result.action).toBe('change_plan');
    expect(result.planKey).toBe('starter');
    expect(result.message).toContain('Starter plan');
  });

  it('blocks paid to Free change-plan', async () => {
    const { service } = buildService();
    await expect(service.changePlan(workspaceId, 'free')).rejects.toMatchObject({
      response: { errorCode: 'billing_downgrade_not_allowed' },
    });
  });

  it('blocks same plan change-plan', async () => {
    const { service } = buildService({
      entitlements: { planKey: 'pro', isTrialPlan: false },
    });
    await expect(service.changePlan(workspaceId, 'pro')).rejects.toMatchObject({
      response: { errorCode: 'plan_already_active' },
    });
  });

  it('blocks Free trial change-plan in favor of checkout', async () => {
    const { service } = buildService({
      subscription: null,
      entitlements: { planKey: 'free', isTrialPlan: true },
    });
    await expect(service.changePlan(workspaceId, 'starter')).rejects.toMatchObject({
      response: { errorCode: 'billing_checkout_required' },
    });
  });

  it('blocks Starter to Pro via change-plan (checkout required)', async () => {
    const { service } = buildService({
      subscription: buildSubscription({ planKey: 'starter' }),
      entitlements: { planKey: 'starter', isTrialPlan: false },
    });
    await expect(service.changePlan(workspaceId, 'pro')).rejects.toMatchObject({
      response: { errorCode: 'billing_checkout_required' },
    });
  });

  it('owner can restore cancel-at-period-end subscription', async () => {
    const { service, billingProviderService, webhookProcessingService } = buildService({
      subscription: buildSubscription({
        cancelAtPeriodEnd: true,
        status: 'active',
      }),
      reloadSubscription: buildSubscription({ cancelAtPeriodEnd: false, status: 'active' }),
    });

    const result = await service.restoreSubscription(workspaceId);

    expect(billingProviderService.restoreSubscription).toHaveBeenCalledWith({
      providerSubscriptionId: 'sub-1',
    });
    expect(webhookProcessingService.applyAction).toHaveBeenCalled();
    expect(result.action).toBe('restore');
    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(result.message).toBe('Subscription restored.');
  });

  it('blocks restore when period already ended', async () => {
    const { service } = buildService({
      subscription: buildSubscription({
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date('2020-01-01T00:00:00.000Z'),
      }),
    });
    await expect(service.restoreSubscription(workspaceId)).rejects.toMatchObject({
      response: { errorCode: 'billing_restore_not_allowed' },
    });
  });

  it('blocks restore when not scheduled to cancel', async () => {
    const { service } = buildService({
      subscription: buildSubscription({ cancelAtPeriodEnd: false, status: 'active' }),
    });
    await expect(service.restoreSubscription(workspaceId)).rejects.toMatchObject({
      response: { errorCode: 'billing_restore_not_allowed' },
    });
  });

  it('maps provider errors to friendly codes', async () => {
    const { service, billingProviderService } = buildService();
    billingProviderService.cancelSubscription.mockRejectedValue(
      new BillingProviderActionError('failed', 'billing_provider_action_failed', 422),
    );

    await expect(service.cancelSubscription(workspaceId, true)).rejects.toMatchObject({
      response: { errorCode: 'billing_provider_action_failed' },
    });
  });
});
