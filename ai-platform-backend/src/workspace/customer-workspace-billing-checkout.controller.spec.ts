import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { CustomerWorkspaceBillingCheckoutController } from './customer-workspace-billing-checkout.controller';

describe('CustomerWorkspaceBillingCheckoutController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const ownerUserId = '507f1f77bcf86cd799439012';
  const memberUserId = '507f1f77bcf86cd799439013';

  const ownerReq = {
    user: { _id: ownerUserId, email: 'owner@example.com', role: 'customer' },
  } as never;

  const memberReq = {
    user: { _id: memberUserId, email: 'member@example.com', role: 'customer' },
  } as never;

  function buildController(ownerAllowed = true) {
    const workspacesService = {
      assertWorkspaceOwner: ownerAllowed
        ? jest.fn().mockResolvedValue(undefined)
        : jest.fn().mockRejectedValue(
            new ForbiddenException({ errorCode: 'workspace_owner_required' }),
          ),
    };
    const billingCheckoutService = {
      createPlanCheckout: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://pay.example/plan',
        provider: 'lemon_squeezy',
      }),
      createAddonCheckout: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://pay.example/addon',
        provider: 'lemon_squeezy',
      }),
      createTopUpCheckout: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://pay.example/topup',
        provider: 'lemon_squeezy',
      }),
    };
    const billingAiCreditsAutoTopUpService = {
      beginEnableCheckout: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://pay.example/auto-topup',
        provider: 'lemon_squeezy',
      }),
    };
    const controller = new CustomerWorkspaceBillingCheckoutController(
      billingCheckoutService as never,
      billingAiCreditsAutoTopUpService as never,
      workspacesService as never,
    );
    return { controller, workspacesService, billingCheckoutService };
  }

  it('owner can create Starter checkout', async () => {
    const { controller, billingCheckoutService } = buildController();
    const result = await controller.checkoutPlan(ownerReq, workspaceId, { planKey: 'starter' });
    expect(result.checkoutUrl).toContain('pay.example');
    expect(billingCheckoutService.createPlanCheckout).toHaveBeenCalledWith(
      workspaceId,
      ownerUserId,
      'starter',
      undefined,
    );
  });

  it('owner can create Pro checkout', async () => {
    const { controller, billingCheckoutService } = buildController();
    await controller.checkoutPlan(ownerReq, workspaceId, { planKey: 'pro' });
    expect(billingCheckoutService.createPlanCheckout).toHaveBeenCalledWith(
      workspaceId,
      ownerUserId,
      'pro',
      undefined,
    );
  });

  it('admin/member cannot create checkout', async () => {
    const { controller } = buildController(false);
    await expect(controller.checkoutPlan(memberReq, workspaceId, { planKey: 'starter' })).rejects.toMatchObject({
      response: { errorCode: 'workspace_owner_required' },
    });
    await expect(controller.checkoutAddon(memberReq, workspaceId, { addonKey: 'extra_bot' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('surfaces billing_provider_not_configured from service', async () => {
    const { controller, billingCheckoutService } = buildController();
    billingCheckoutService.createPlanCheckout.mockRejectedValue(
      new ServiceUnavailableException({ errorCode: 'billing_provider_not_configured' }),
    );
    await expect(controller.checkoutPlan(ownerReq, workspaceId, { planKey: 'starter' })).rejects.toMatchObject({
      response: { errorCode: 'billing_provider_not_configured' },
    });
  });
});
