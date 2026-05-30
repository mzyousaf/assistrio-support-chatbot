import { ForbiddenException } from '@nestjs/common';
import { CustomerWorkspaceBillingController } from './customer-workspace-billing.controller';

describe('CustomerWorkspaceBillingController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';

  function buildController(overrides?: { isMember?: boolean; isOwner?: boolean }) {
    const billingSummaryService = {
      getSummary: jest.fn().mockResolvedValue({
        workspaceId,
        plan: { key: 'pro' },
        subscription: { subscriptionStatus: 'active' },
      }),
    };
    const billingSubscriptionActionsService = {
      cancelSubscription: jest.fn().mockResolvedValue({
        ok: true,
        action: 'cancel',
        message: 'Subscription cancellation scheduled.',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: '2026-07-01T00:00:00.000Z',
      }),
      changePlan: jest.fn().mockResolvedValue({
        ok: true,
        action: 'change_plan',
        planKey: 'starter',
        message: 'Your workspace is now on the Starter plan.',
      }),
      restoreSubscription: jest.fn().mockResolvedValue({
        ok: true,
        action: 'restore',
        message: 'Subscription restored.',
        cancelAtPeriodEnd: false,
      }),
    };
    const billingAddonActionsService = {
      cancelAddon: jest.fn().mockResolvedValue({
        ok: true,
        message: 'Add-on cancellation scheduled.',
        addonKey: 'extra_bot',
        cancelAtPeriodEnd: true,
      }),
    };
    const billingManageService = {
      createManageBillingUrl: jest.fn().mockResolvedValue({
        url: 'https://store.lemonsqueezy.com/billing?signed=1',
        provider: 'lemon_squeezy',
      }),
    };
    const billingInvoicesService = {
      listWorkspaceInvoices: jest.fn().mockResolvedValue([]),
      exportBillingHistoryCsv: jest.fn().mockResolvedValue(
        '\uFEFFDate,Item,Description,Type,Amount,Currency,Status,Provider,Invoice/Receipt URL\r\n',
      ),
      getBillingHistoryCsvFilename: jest.fn().mockReturnValue('assistrio-billing-history.csv'),
      downloadBillingItemPdf: jest.fn().mockResolvedValue({
        downloadUrl: 'https://invoice.example/plan.pdf',
      }),
      streamBillingItemPdf: jest.fn().mockResolvedValue({
        mode: 'pdf',
        buffer: Buffer.from('%PDF-1.4 test'),
        filename: 'assistrio-billing-inv-plan.pdf',
      }),
    };
    const billingProfileService = {
      getProfile: jest.fn().mockResolvedValue(null),
      upsertProfile: jest.fn().mockResolvedValue({
        workspaceId,
        name: 'Jane Doe',
        address: '123 Mall Road',
        city: 'Lahore',
        zipCode: '54000',
        country: 'PK',
        updatedAt: '2026-05-01T00:00:00.000Z',
        updatedBy: userId,
      }),
    };
    const workspacesService = {
      isUserMemberOfWorkspace: jest.fn().mockResolvedValue(overrides?.isMember ?? true),
      assertWorkspaceOwner: jest.fn().mockImplementation(async () => {
        if (overrides?.isOwner === false) {
          throw new ForbiddenException({ error: 'Workspace owner required.' });
        }
      }),
      assertWorkspaceAdmin: jest.fn().mockImplementation(async () => {
        if (overrides?.isOwner === false) {
          throw new ForbiddenException({ error: 'Workspace access denied.' });
        }
      }),
    };

    const controller = new CustomerWorkspaceBillingController(
      billingSummaryService as never,
      billingSubscriptionActionsService as never,
      billingAddonActionsService as never,
      billingManageService as never,
      billingInvoicesService as never,
      billingProfileService as never,
      workspacesService as never,
    );

    return {
      controller,
      billingSummaryService,
      billingSubscriptionActionsService,
      billingAddonActionsService,
      billingManageService,
      billingInvoicesService,
      billingProfileService,
      workspacesService,
    };
  }

  it('blocks non-members from billing summary endpoint', async () => {
    const { controller } = buildController({ isMember: false });
    const req = { user: { _id: userId } } as never;

    await expect(controller.getBillingSummary(req, workspaceId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns billing summary for workspace members', async () => {
    const { controller, billingSummaryService } = buildController();
    const req = { user: { _id: userId } } as never;

    const result = await controller.getBillingSummary(req, workspaceId);

    expect(billingSummaryService.getSummary).toHaveBeenCalledWith(workspaceId);
    expect(result).toMatchObject({ workspaceId, plan: { key: 'pro' } });
  });

  it('owner can open billing portal session', async () => {
    const { controller, billingManageService } = buildController({ isOwner: true });
    const req = { user: { _id: userId } } as never;

    const result = await controller.createManageBillingSession(req, workspaceId);

    expect(billingManageService.createManageBillingUrl).toHaveBeenCalledWith(workspaceId);
    expect(result.url).toContain('lemonsqueezy.com');
  });

  it('blocks non-owner from billing portal session', async () => {
    const { controller } = buildController({ isOwner: false });
    const req = { user: { _id: userId } } as never;

    await expect(controller.createManageBillingSession(req, workspaceId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('owner can restore subscription and receives refreshed summary', async () => {
    const { controller, billingSubscriptionActionsService, billingSummaryService } =
      buildController({ isOwner: true });
    const req = { user: { _id: userId } } as never;

    const result = await controller.restoreSubscription(req, workspaceId);

    expect(billingSubscriptionActionsService.restoreSubscription).toHaveBeenCalledWith(workspaceId);
    expect(billingSummaryService.getSummary).toHaveBeenCalledWith(workspaceId);
    expect(result.message).toBe('Subscription restored.');
    expect(result.action).toBe('restore');
    expect(result.summary).toMatchObject({ workspaceId });
  });

  it('blocks non-owner from restore subscription', async () => {
    const { controller } = buildController({ isOwner: false });
    const req = { user: { _id: userId } } as never;

    await expect(controller.restoreSubscription(req, workspaceId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('owner can change plan and receives refreshed summary', async () => {
    const { controller, billingSubscriptionActionsService, billingSummaryService } =
      buildController({ isOwner: true });
    const req = { user: { _id: userId } } as never;

    const result = await controller.changeSubscriptionPlan(req, workspaceId, { planKey: 'starter' });

    expect(billingSubscriptionActionsService.changePlan).toHaveBeenCalledWith(
      workspaceId,
      'starter',
    );
    expect(billingSummaryService.getSummary).toHaveBeenCalledWith(workspaceId);
    expect(result.action).toBe('change_plan');
    expect(result.summary).toMatchObject({ workspaceId });
  });

  it('blocks member from change plan', async () => {
    const { controller } = buildController({ isOwner: false });
    const req = { user: { _id: userId } } as never;

    await expect(
      controller.changeSubscriptionPlan(req, workspaceId, { planKey: 'starter' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('owner/admin can read billing profile', async () => {
    const { controller, billingProfileService } = buildController({ isOwner: true });
    const req = { user: { _id: userId } } as never;

    const result = await controller.getBillingProfile(req, workspaceId);

    expect(billingProfileService.getProfile).toHaveBeenCalledWith(workspaceId);
    expect(result).toEqual({ profile: null });
  });

  it('owner/admin can save billing profile', async () => {
    const { controller, billingProfileService } = buildController({ isOwner: true });
    const req = { user: { _id: userId } } as never;

    const result = await controller.patchBillingProfile(req, workspaceId, {
      name: 'Jane Doe',
      address: '123 Mall Road',
      city: 'Lahore',
      zipCode: '54000',
      country: 'PK',
    });

    expect(billingProfileService.upsertProfile).toHaveBeenCalledWith(
      workspaceId,
      userId,
      expect.objectContaining({ country: 'PK' }),
    );
    expect(result.profile.country).toBe('PK');
  });

  it('blocks member from billing profile endpoints', async () => {
    const { controller } = buildController({ isOwner: false });
    const req = { user: { _id: userId } } as never;

    await expect(controller.getBillingProfile(req, workspaceId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      controller.patchBillingProfile(req, workspaceId, { name: 'Jane Doe' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('owner/admin can list billing invoices', async () => {
    const { controller, billingInvoicesService } = buildController({ isOwner: true });
    const req = { user: { _id: userId } } as never;

    const result = await controller.listBillingInvoices(req, workspaceId);

    expect(billingInvoicesService.listWorkspaceInvoices).toHaveBeenCalledWith(workspaceId);
    expect(result).toEqual([]);
  });

  it('blocks member from billing invoices endpoint', async () => {
    const { controller } = buildController({ isOwner: false });
    const req = { user: { _id: userId } } as never;

    await expect(controller.listBillingInvoices(req, workspaceId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('owner/admin can download billing history CSV', async () => {
    const { controller, billingInvoicesService } = buildController({ isOwner: true });
    const req = { user: { _id: userId } } as never;
    const res = {
      header: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await controller.downloadBillingHistory(req, workspaceId, res as never);

    expect(billingInvoicesService.exportBillingHistoryCsv).toHaveBeenCalledWith(workspaceId);
    expect(res.header).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.header).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="assistrio-billing-history.csv"',
    );
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Date,Item,Description'));
  });

  it('blocks member from billing history download endpoint', async () => {
    const { controller } = buildController({ isOwner: false });
    const req = { user: { _id: userId } } as never;
    const res = {
      header: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await expect(
      controller.downloadBillingHistory(req, workspaceId, res as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('owner/admin can download billing invoice PDF', async () => {
    const { controller, billingInvoicesService } = buildController({ isOwner: true });
    const req = { user: { _id: userId } } as never;

    const result = await controller.downloadBillingInvoice(req, workspaceId, 'inv-plan', {
      name: 'Jane Doe',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '90210',
      country: 'US',
    });

    expect(billingInvoicesService.downloadBillingItemPdf).toHaveBeenCalledWith(
      workspaceId,
      'inv-plan',
      expect.objectContaining({ name: 'Jane Doe' }),
    );
    expect(result).toEqual({ downloadUrl: 'https://invoice.example/plan.pdf' });
  });

  it('blocks member from billing invoice download endpoint', async () => {
    const { controller } = buildController({ isOwner: false });
    const req = { user: { _id: userId } } as never;

    await expect(
      controller.downloadBillingInvoice(req, workspaceId, 'inv-plan', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('owner/admin streams billing invoice PDF with attachment headers', async () => {
    const { controller, billingInvoicesService } = buildController({ isOwner: true });
    const req = { user: { _id: userId } } as never;
    const res = {
      header: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await controller.streamBillingInvoicePdf(req, workspaceId, 'inv-plan', {}, res as never);

    expect(billingInvoicesService.streamBillingItemPdf).toHaveBeenCalledWith(
      workspaceId,
      'inv-plan',
      {},
      expect.objectContaining({
        userId: String(userId),
        requestId: expect.any(String),
      }),
    );
    expect(res.header).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.header).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="assistrio-billing-inv-plan.pdf"',
    );
    expect(res.header).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('%PDF-1.4 test'));
    expect(String(res.send.mock.calls[0][0])).not.toContain('lemonsqueezy.com');
  });

  it('returns provider URL JSON when hosted invoice page is available', async () => {
    const { controller, billingInvoicesService } = buildController({ isOwner: true });
    billingInvoicesService.streamBillingItemPdf = jest.fn().mockResolvedValue({
      mode: 'provider_url',
      url: 'https://app.lemonsqueezy.com/my-orders/inv-plan',
      source: 'lemon_subscription_invoice',
    });
    const req = { user: { _id: userId } } as never;
    const res = {
      header: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await controller.streamBillingInvoicePdf(req, workspaceId, 'inv-plan', {}, res as never);

    expect(res.header).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    expect(res.send).toHaveBeenCalledWith({
      mode: 'provider_url',
      url: 'https://app.lemonsqueezy.com/my-orders/inv-plan',
      source: 'lemon_subscription_invoice',
    });
  });

  it('blocks member from billing invoice PDF endpoint', async () => {
    const { controller } = buildController({ isOwner: false });
    const req = { user: { _id: userId } } as never;
    const res = {
      header: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await expect(
      controller.streamBillingInvoicePdf(req, workspaceId, 'inv-plan', {}, res as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('owner can cancel recurring add-on', async () => {
    const { controller, billingAddonActionsService, billingSummaryService } = buildController({
      isOwner: true,
    });
    const req = { user: { _id: userId } } as never;

    const result = await controller.cancelAddon(req, workspaceId, {
      addonKey: 'extra_bot',
    });

    expect(billingAddonActionsService.cancelAddon).toHaveBeenCalledWith(
      workspaceId,
      'extra_bot',
      null,
    );
    expect(billingSummaryService.getSummary).toHaveBeenCalledWith(workspaceId);
    expect(result.summary).toMatchObject({ workspaceId });
  });
});
