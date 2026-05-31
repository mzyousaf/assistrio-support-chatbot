import { BadRequestException } from '@nestjs/common';
import { BillingInvoicesService } from './billing-invoices.service';

describe('BillingInvoicesService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function subscriptionRowId(invoiceId: string, subscriptionId: string): string {
    return `lemon_subscription_invoice:${invoiceId}:${subscriptionId}`;
  }

  function createModels(input?: {
    subscription?: unknown;
    addons?: unknown[];
    topUps?: unknown[];
    billingOrders?: unknown[];
  }) {
    const topUpRows = input?.topUps ?? [];
    const billingOrderRows = input?.billingOrders ?? [];

    return {
      subscriptionModel: {
        findOne: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(input?.subscription ?? null),
            }),
          }),
        }),
      },
      addonModel: {
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(input?.addons ?? []),
            }),
          }),
        }),
      },
      topUpModel: {
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(topUpRows),
            }),
          }),
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(topUpRows),
            }),
          }),
        }),
      },
      billingOrderModel: {
        exists: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue(
              billingOrderRows.length > 0 || topUpRows.length > 0 ? { _id: '1' } : null,
            ),
        }),
        updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) }),
        find: jest.fn().mockImplementation((query?: { checkoutType?: string }) => {
          const isPlanQuery = query?.checkoutType === 'plan';
          const resultRows = isPlanQuery
            ? billingOrderRows.filter(
                (row) => (row as { checkoutType?: string }).checkoutType === 'plan',
              )
            : billingOrderRows;
          const exec = jest.fn().mockResolvedValue(resultRows);
          const lean = jest.fn().mockReturnValue({ exec });
          const select = jest.fn().mockReturnValue({ lean });
          return {
            sort: jest.fn().mockReturnValue({
              lean,
              select,
            }),
          };
        }),
      },
      workspaceModel: {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ name: 'Acme Workspace' }),
            }),
          }),
        }),
      },
      userModel: {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({
                email: 'jane@example.com',
                firstName: 'Jane',
                lastName: 'Doe',
              }),
            }),
          }),
        }),
      },
    };
  }

  function createBillingProfileService(overrides?: {
    hasCompleteProfile?: boolean;
    invoiceDetails?: Record<string, unknown> | null;
    profile?: Record<string, unknown> | null;
  }) {
    return {
      hasCompleteProfile: jest
        .fn()
        .mockResolvedValue(overrides?.hasCompleteProfile ?? false),
      getInvoiceDetailsForOrder: jest.fn().mockResolvedValue(overrides?.invoiceDetails ?? null),
      getProfile: jest.fn().mockResolvedValue(overrides?.profile ?? null),
      upsertProfile: jest.fn().mockResolvedValue({
        workspaceId,
        name: 'Jane Doe',
        address: '123 Mall Road',
        city: 'Lahore',
        zipCode: '54000',
        country: 'PK',
        updatedAt: '2026-05-01T00:00:00.000Z',
        updatedBy: '507f1f77bcf86cd799439012',
      }),
    };
  }

  function mockPdfFetchResponse(content = '%PDF-1.4 generated-invoice') {
    const buffer = Buffer.from(content);
    return {
      ok: true,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? 'application/pdf' : null,
      },
      arrayBuffer: async () =>
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
  }

  function mockGenerateOrderInvoice(downloadUrl = 'https://app.lemonsqueezy.com/invoice/download/order-top-up') {
    return jest.fn().mockResolvedValue({ downloadUrl });
  }

  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createService(
    models: ReturnType<typeof createModels>,
    billingProviderService: Record<string, jest.Mock>,
    billingProfileService: ReturnType<typeof createBillingProfileService> = createBillingProfileService(),
  ) {
    return new BillingInvoicesService(
      models.subscriptionModel as never,
      models.addonModel as never,
      models.topUpModel as never,
      models.billingOrderModel as never,
      models.workspaceModel as never,
      models.userModel as never,
      billingProviderService as never,
      billingProfileService as never,
    );
  }

  it('maps Starter plan invoice by main providerSubscriptionId', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      addons: [{ addonKey: 'extra_bot', providerSubscriptionId: 'sub-addon-bot', status: 'active' }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn(async (subId: string) => {
        if (subId === 'sub-plan') {
          return [
            {
              id: 'inv-plan-1',
              provider: 'lemon_squeezy',
              date: '2026-05-01T00:00:00.000Z',
              amount: 49,
              amountCents: 4900,
              amountFormatted: '$49.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: 'https://invoice.example/plan-1',
              receiptUrl: null,
              description: 'Starter subscription',
              billingReason: 'initial',
              providerSubscriptionId: 'sub-plan',
              providerVariantId: '111',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        return [];
      }),
    };

    const service = createService(models, billingProviderService);

    const rows = await service.listWorkspaceInvoices(workspaceId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: subscriptionRowId('inv-plan-1', 'sub-plan'),
      itemType: 'plan',
      itemKey: 'starter',
      itemName: 'Starter',
      description: 'Starter subscription started',
      amountFormatted: '$49.00',
      invoiceUrl: 'https://invoice.example/plan-1',
      source: 'lemon_subscription_invoice',
    });
    expect(rows[0]?.description).not.toContain('trained knowledge');
  });

  it('does not map plan invoice to KB add-on even when KB add-on is active', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'pro',
      },
      addons: [{ addonKey: 'extra_bot', providerSubscriptionId: 'sub-addon-bot', status: 'active' }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn(async (subId: string) => {
        if (subId === 'sub-plan') {
          return [
            {
              id: 'inv-plan-2',
              provider: 'lemon_squeezy',
              date: '2026-06-01T00:00:00.000Z',
              amount: 99,
              amountCents: 9900,
              amountFormatted: '$99.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: 'https://invoice.example/plan-2',
              receiptUrl: null,
              description: 'Pro subscription',
              billingReason: 'renewal',
              providerSubscriptionId: 'sub-plan',
              providerVariantId: '222',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        return [];
      }),
    };

    const service = createService(models, billingProviderService);

    const rows = await service.listWorkspaceInvoices(workspaceId);
    expect(rows[0]).toMatchObject({
      itemType: 'plan',
      itemKey: 'pro',
      description: 'Pro subscription renewal',
    });
  });

  it('maps KB add-on invoice only for matching addon providerSubscriptionId', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      addons: [{ addonKey: 'extra_bot', providerSubscriptionId: 'sub-addon-bot', status: 'active' }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn(async (subId: string) => {
        if (subId === 'sub-addon-bot') {
          return [
            {
              id: 'inv-addon-kb',
              provider: 'lemon_squeezy',
              date: '2026-05-03T00:00:00.000Z',
              amount: 10,
              amountCents: 1000,
              amountFormatted: '$10.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: 'https://invoice.example/kb',
              receiptUrl: null,
              description: 'Addon',
              billingReason: 'initial',
              providerSubscriptionId: 'sub-addon-bot',
              providerVariantId: '555',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        return [];
      }),
    };

    const service = createService(models, billingProviderService);

    const rows = await service.listWorkspaceInvoices(workspaceId);
    const kbRow = rows.find((row) => row.id === subscriptionRowId('inv-addon-kb', 'sub-addon-bot'));
    expect(kbRow).toMatchObject({
      itemType: 'addon',
      itemKey: 'extra_bot',
      itemName: 'Extra AI Agent',
      description: 'Extra AI Agent add-on',
      amountFormatted: '$10.00',
      invoiceUrl: 'https://invoice.example/kb',
    });
  });

  it('keeps Starter and KB add-on invoices separate without cross-labeling', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      addons: [{ addonKey: 'extra_bot', providerSubscriptionId: 'sub-addon-bot', status: 'active' }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn(async (subId: string) => {
        if (subId === 'sub-plan') {
          return [
            {
              id: 'inv-plan-1',
              provider: 'lemon_squeezy',
              date: '2026-05-01T00:00:00.000Z',
              amount: 49,
              amountCents: 4900,
              amountFormatted: '$49.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: 'https://invoice.example/starter',
              receiptUrl: null,
              description: 'Starter subscription',
              billingReason: 'initial',
              providerSubscriptionId: 'sub-plan',
              providerVariantId: '111',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        if (subId === 'sub-addon-bot') {
          return [
            {
              id: 'inv-addon-kb',
              provider: 'lemon_squeezy',
              date: '2026-05-03T00:00:00.000Z',
              amount: 10,
              amountCents: 1000,
              amountFormatted: '$10.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: 'https://invoice.example/kb-addon',
              receiptUrl: null,
              description: 'KB add-on',
              billingReason: 'initial',
              providerSubscriptionId: 'sub-addon-bot',
              providerVariantId: '555',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        return [];
      }),
    };

    const service = createService(models, billingProviderService);
    const rows = await service.listWorkspaceInvoices(workspaceId);

    expect(rows).toHaveLength(2);
    const starterRow = rows.find((row) => row.id === subscriptionRowId('inv-plan-1', 'sub-plan'));
    const kbRow = rows.find((row) => row.id === subscriptionRowId('inv-addon-kb', 'sub-addon-bot'));

    expect(starterRow).toMatchObject({
      itemType: 'plan',
      itemName: 'Starter',
      amountFormatted: '$49.00',
      invoiceUrl: 'https://invoice.example/starter',
    });
    expect(kbRow).toMatchObject({
      itemType: 'addon',
      itemName: 'Extra AI Agent',
      amountFormatted: '$10.00',
      invoiceUrl: 'https://invoice.example/kb-addon',
    });
    expect(starterRow?.itemName).not.toContain('trained knowledge');
    expect(kbRow?.itemName).not.toBe('Starter');
  });

  it('fetches main Starter invoices when workspace subscription id was overwritten by add-on id', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-addon-bot',
        planKey: 'starter',
        status: 'active',
      },
      addons: [{ addonKey: 'extra_bot', providerSubscriptionId: 'sub-addon-bot', status: 'active' }],
      billingOrders: [
        {
          checkoutType: 'plan',
          providerSubscriptionId: 'sub-plan',
          orderCreatedAt: new Date('2026-05-01T00:00:00.000Z'),
        },
      ],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listCustomerPlanSubscriptions: jest.fn().mockResolvedValue([]),
      listSubscriptionInvoices: jest.fn(async (subId: string) => {
        if (subId === 'sub-plan') {
          return [
            {
              id: 'inv-plan-1',
              provider: 'lemon_squeezy',
              date: '2026-05-01T00:00:00.000Z',
              amount: 49,
              amountCents: 4900,
              amountFormatted: '$49.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: 'https://invoice.example/starter',
              receiptUrl: null,
              description: 'Starter subscription',
              billingReason: 'initial',
              providerSubscriptionId: 'sub-plan',
              providerVariantId: '111',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        if (subId === 'sub-addon-bot') {
          return [
            {
              id: 'inv-addon-kb',
              provider: 'lemon_squeezy',
              date: '2026-05-03T00:00:00.000Z',
              amount: 10,
              amountCents: 1000,
              amountFormatted: '$10.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: 'https://invoice.example/kb-addon',
              receiptUrl: null,
              description: 'KB add-on',
              billingReason: 'initial',
              providerSubscriptionId: 'sub-addon-bot',
              providerVariantId: '555',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        return [];
      }),
    };

    const service = createService(models, billingProviderService);
    const rows = await service.listWorkspaceInvoices(workspaceId);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === subscriptionRowId('inv-plan-1', 'sub-plan'))).toMatchObject({
      itemType: 'plan',
      itemName: 'Starter',
      amountFormatted: '$49.00',
    });
    expect(rows.find((row) => row.id === subscriptionRowId('inv-addon-kb', 'sub-addon-bot'))).toMatchObject({
      itemType: 'addon',
      itemName: 'Extra AI Agent',
    });
  });

  it('fetches canceled-at-period-end main subscription invoices', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'pro',
        status: 'canceled',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
      },
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listCustomerPlanSubscriptions: jest.fn().mockResolvedValue([]),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([
        {
          id: 'inv-pro',
          provider: 'lemon_squeezy',
          date: '2026-05-01T00:00:00.000Z',
          amount: 99,
          amountCents: 9900,
          amountFormatted: '$99.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/pro',
          receiptUrl: null,
          description: 'Pro subscription',
          billingReason: 'renewal',
          providerSubscriptionId: 'sub-plan',
          providerVariantId: '222',
          source: 'lemon_subscription_invoice',
        },
      ]),
    };

    const service = createService(models, billingProviderService);
    const rows = await service.listWorkspaceInvoices(workspaceId);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      itemType: 'plan',
      itemName: 'Pro',
      description: 'Pro subscription renewal',
    });
  });

  it('skips main plan fetch when provider subscription id is missing and cannot be recovered', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: null,
        planKey: 'starter',
        status: 'active',
      },
      addons: [{ addonKey: 'extra_bot', providerSubscriptionId: 'sub-addon-bot', status: 'active' }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listCustomerPlanSubscriptions: jest.fn().mockResolvedValue([]),
      listSubscriptionInvoices: jest.fn(async (subId: string) => {
        if (subId === 'sub-addon-bot') {
          return [
            {
              id: 'inv-addon-kb',
              provider: 'lemon_squeezy',
              date: '2026-05-03T00:00:00.000Z',
              amount: 10,
              amountCents: 1000,
              amountFormatted: '$10.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: 'https://invoice.example/kb-addon',
              receiptUrl: null,
              description: 'KB add-on',
              billingReason: 'initial',
              providerSubscriptionId: 'sub-addon-bot',
              providerVariantId: '555',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        return [];
      }),
    };

    const service = createService(models, billingProviderService);
    const rows = await service.listWorkspaceInvoices(workspaceId);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.itemType).toBe('addon');
    expect(billingProviderService.listSubscriptionInvoices).not.toHaveBeenCalledWith('sub-plan', expect.anything());
  });

  it('does not dedupe plan and add-on rows that share the same provider invoice id', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      addons: [{ addonKey: 'extra_bot', providerSubscriptionId: 'sub-addon-bot', status: 'active' }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn(async (subId: string) => {
        if (subId === 'sub-plan') {
          return [
            {
              id: 'shared-inv-id',
              provider: 'lemon_squeezy',
              date: '2026-05-01T00:00:00.000Z',
              amount: 49,
              amountCents: 4900,
              amountFormatted: '$49.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: 'https://invoice.example/starter',
              receiptUrl: null,
              description: 'Starter subscription',
              billingReason: 'initial',
              providerSubscriptionId: 'sub-plan',
              providerVariantId: '111',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        if (subId === 'sub-addon-bot') {
          return [
            {
              id: 'shared-inv-id',
              provider: 'lemon_squeezy',
              date: '2026-05-03T00:00:00.000Z',
              amount: 10,
              amountCents: 1000,
              amountFormatted: '$10.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: 'https://invoice.example/kb-addon',
              receiptUrl: null,
              description: 'KB add-on',
              billingReason: 'initial',
              providerSubscriptionId: 'sub-addon-bot',
              providerVariantId: '555',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        return [];
      }),
    };

    const service = createService(models, billingProviderService);
    const rows = await service.listWorkspaceInvoices(workspaceId);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual(
      expect.arrayContaining([
        subscriptionRowId('shared-inv-id', 'sub-plan'),
        subscriptionRowId('shared-inv-id', 'sub-addon-bot'),
      ]),
    );
  });

  it('deduplicates provider invoice ids and sorts newest first', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([
        {
          id: 'inv-dup',
          provider: 'lemon_squeezy',
          date: '2026-05-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/dup',
          receiptUrl: null,
          description: 'Starter subscription started',
          billingReason: 'initial',
          providerSubscriptionId: 'sub-plan',
          source: 'lemon_subscription_invoice',
        },
        {
          id: 'inv-dup',
          provider: 'lemon_squeezy',
          date: '2026-05-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/dup',
          receiptUrl: null,
          description: 'Starter subscription started',
          billingReason: 'initial',
          providerSubscriptionId: 'sub-plan',
          source: 'lemon_subscription_invoice',
        },
        {
          id: 'inv-newer',
          provider: 'lemon_squeezy',
          date: '2026-06-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/newer',
          receiptUrl: null,
          description: 'Starter subscription renewal',
          billingReason: 'renewal',
          providerSubscriptionId: 'sub-plan',
          source: 'lemon_subscription_invoice',
        },
      ]),
    };

    const service = createService(models, billingProviderService);

    const rows = await service.listWorkspaceInvoices(workspaceId);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.id === subscriptionRowId('inv-dup', 'sub-plan'))).toHaveLength(1);
    expect(rows[0]?.id).toBe(subscriptionRowId('inv-newer', 'sub-plan'));
  });

  it('includes top-up order payments in invoice list', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      topUps: [
        {
          providerOrderId: 'order-1',
          creditsPurchased: 1000,
          creditsRemaining: 800,
          createdAt: new Date('2026-05-02T00:00:00.000Z'),
        },
      ],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      fetchOrderInvoice: jest.fn().mockResolvedValue({
        id: 'order-1',
        provider: 'lemon_squeezy',
        date: '2026-05-02T00:00:00.000Z',
        amount: 30,
        amountCents: 3000,
        amountFormatted: '$30.00',
        currency: 'USD',
        status: 'paid',
        invoiceUrl: null,
        receiptUrl: null,
        description: '1,000 AI credits top-up',
        providerOrderId: 'order-1',
        source: 'lemon_order',
      }),
    };

    const service = createService(models, billingProviderService);
    const rows = await service.listWorkspaceInvoices(workspaceId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'order-1',
      itemType: 'top_up',
      description: '1,000 AI credits top-up',
        billingKind: 'order',
        requiresBillingDetails: true,
      });
  });

  it('lists subscription invoices even when invoice_url is missing', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([
        {
          id: 'inv-no-url',
          provider: 'lemon_squeezy',
          date: '2026-05-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: null,
          receiptUrl: null,
          description: 'Starter subscription started',
          billingReason: 'initial',
          providerSubscriptionId: 'sub-plan',
          source: 'lemon_subscription_invoice',
        },
        {
          id: 'inv-with-url',
          provider: 'lemon_squeezy',
          date: '2026-06-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/plan',
          receiptUrl: null,
          description: 'Starter subscription renewal',
          billingReason: 'renewal',
          providerSubscriptionId: 'sub-plan',
          source: 'lemon_subscription_invoice',
        },
      ]),
    };

    const service = createService(models, billingProviderService);
    const rows = await service.listWorkspaceInvoices(workspaceId);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === subscriptionRowId('inv-no-url', 'sub-plan'))?.billingKind).toBe(
      'subscription_invoice',
    );
    expect(rows.find((row) => row.id === subscriptionRowId('inv-with-url', 'sub-plan'))?.invoiceUrl).toBe(
      'https://invoice.example/plan',
    );
  });

  it('returns official Lemon URL for subscription invoice download endpoint', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([
        {
          id: 'inv-plan',
          provider: 'lemon_squeezy',
          date: '2026-05-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/plan-page',
          receiptUrl: null,
          description: 'Starter subscription started',
          billingReason: 'initial',
          providerSubscriptionId: 'sub-plan',
          source: 'lemon_subscription_invoice',
        },
      ]),
    };

    const service = createService(models, billingProviderService);
    await expect(
      service.downloadBillingItemPdf(workspaceId, subscriptionRowId('inv-plan', 'sub-plan')),
    ).resolves.toEqual({
      downloadUrl: 'https://invoice.example/plan-page',
    });
  });

  it('returns provider hosted URL when Lemon invoice_url is HTML', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([
        {
          id: 'inv-plan',
          provider: 'lemon_squeezy',
          date: '2026-05-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/plan-page',
          receiptUrl: null,
          description: 'Starter subscription started',
          itemType: 'plan',
          itemKey: 'starter',
          itemName: 'Starter',
          billingReason: 'initial',
          providerSubscriptionId: 'sub-plan',
          source: 'lemon_subscription_invoice',
        },
      ]),
    };

    const service = createService(models, billingProviderService);
    const result = await service.streamBillingItemPdf(
      workspaceId,
      subscriptionRowId('inv-plan', 'sub-plan'),
      undefined,
      {
        requestId: 'req-1',
        userId: '507f1f77bcf86cd799439012',
      },
    );

    expect(result).toEqual({
      mode: 'provider_url',
      url: 'https://invoice.example/plan-page',
      source: 'lemon_subscription_invoice',
    });
  });

  it('generates Lemon order invoice when saved billing profile exists', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      topUps: [{ providerOrderId: 'order-top-up', createdAt: new Date('2026-05-02T00:00:00.000Z') }],
    });

    const downloadUrl = 'https://app.lemonsqueezy.com/invoice/download/order-top-up';
    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      fetchOrderInvoice: jest.fn().mockResolvedValue(null),
      generateOrderInvoice: mockGenerateOrderInvoice(downloadUrl),
    };
    const billingProfileService = createBillingProfileService({
      hasCompleteProfile: true,
      invoiceDetails: {
        name: 'Jane Doe',
        address: '123 Mall Road',
        city: 'Lahore',
        zipCode: '54000',
        country: 'PK',
      },
    });

    global.fetch = jest.fn().mockResolvedValue(mockPdfFetchResponse()) as typeof fetch;

    const service = createService(models, billingProviderService, billingProfileService);
    const result = await service.streamBillingItemPdf(workspaceId, 'order-top-up');

    expect(result.mode).toBe('pdf');
    if (result.mode !== 'pdf') return;
    expect(result.buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(billingProviderService.generateOrderInvoice).toHaveBeenCalledWith(
      'order-top-up',
      expect.objectContaining({
        name: 'Jane Doe',
        address: '123 Mall Road',
        city: 'Lahore',
        zipCode: '54000',
        country: 'PK',
      }),
      expect.objectContaining({ requestId: undefined }),
    );
    expect(global.fetch).toHaveBeenCalledWith(downloadUrl, { redirect: 'follow' });
    expect(models.billingOrderModel.updateOne).toHaveBeenCalled();
  });

  it('returns billing_invoice_details_required when order PDF needs details and profile is missing', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      topUps: [{ providerOrderId: 'order-top-up', createdAt: new Date('2026-05-02T00:00:00.000Z') }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      fetchOrderInvoice: jest.fn().mockResolvedValue(null),
      generateOrderInvoice: jest.fn(),
    };
    const billingProfileService = createBillingProfileService({
      profile: {
        workspaceId,
        name: 'Partial',
        address: '',
        city: '',
        zipCode: '',
        country: '',
        updatedAt: '2026-05-01T00:00:00.000Z',
        updatedBy: '507f1f77bcf86cd799439012',
      },
    });

    const service = createService(models, billingProviderService, billingProfileService);
    await expect(service.streamBillingItemPdf(workspaceId, 'order-top-up')).rejects.toMatchObject({
      response: {
        errorCode: 'billing_invoice_details_required',
        profile: expect.objectContaining({ name: 'Partial' }),
      },
    });
    expect(billingProviderService.generateOrderInvoice).not.toHaveBeenCalled();
  });

  it('saves profile when modal-submitted details include saveProfile', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      topUps: [{ providerOrderId: 'order-top-up', createdAt: new Date('2026-05-02T00:00:00.000Z') }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      fetchOrderInvoice: jest.fn().mockResolvedValue(null),
      generateOrderInvoice: mockGenerateOrderInvoice(),
    };
    const billingProfileService = createBillingProfileService();

    global.fetch = jest.fn().mockResolvedValue(mockPdfFetchResponse()) as typeof fetch;

    const service = createService(models, billingProviderService, billingProfileService);
    await service.streamBillingItemPdf(
      workspaceId,
      'order-top-up',
      {
        name: 'Jane Doe',
        address: '123 Mall Road',
        city: 'Lahore',
        zipCode: '54000',
        country: 'PK',
      },
      { requestId: 'req-1', userId: '507f1f77bcf86cd799439012', saveProfile: true },
    );

    expect(billingProfileService.upsertProfile).toHaveBeenCalledWith(
      workspaceId,
      '507f1f77bcf86cd799439012',
      expect.objectContaining({ country: 'PK' }),
    );
    expect(billingProviderService.generateOrderInvoice).toHaveBeenCalledWith(
      'order-top-up',
      expect.objectContaining({ country: 'PK', zipCode: '54000' }),
      expect.any(Object),
    );
  });

  it('generates Lemon order invoice when billing details are provided inline', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      topUps: [{ providerOrderId: 'order-top-up', createdAt: new Date('2026-05-02T00:00:00.000Z') }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      fetchOrderInvoice: jest.fn().mockResolvedValue(null),
      generateOrderInvoice: mockGenerateOrderInvoice(),
    };

    global.fetch = jest.fn().mockResolvedValue(mockPdfFetchResponse()) as typeof fetch;

    const service = createService(models, billingProviderService);
    const result = await service.streamBillingItemPdf(workspaceId, 'order-top-up', {
      name: 'Jane Doe',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '90210',
      country: 'US',
    });

    expect(result.mode).toBe('pdf');
    if (result.mode !== 'pdf') return;
    expect(result.buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(billingProviderService.generateOrderInvoice).toHaveBeenCalledWith(
      'order-top-up',
      expect.objectContaining({
        name: 'Jane Doe',
        state: 'CA',
        zipCode: '90210',
        country: 'US',
      }),
      expect.any(Object),
    );
  });

  it('passes billing address fields to Lemon generate invoice API', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      topUps: [{ providerOrderId: 'order-top-up', createdAt: new Date('2026-05-02T00:00:00.000Z') }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      fetchOrderInvoice: jest.fn().mockResolvedValue(null),
      generateOrderInvoice: mockGenerateOrderInvoice(),
    };

    global.fetch = jest.fn().mockResolvedValue(mockPdfFetchResponse()) as typeof fetch;

    const service = createService(models, billingProviderService);
    await service.streamBillingItemPdf(workspaceId, 'order-top-up', {
      name: 'Jane Doe',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '90210',
      country: 'US',
    });

    expect(billingProviderService.generateOrderInvoice).toHaveBeenCalledWith(
      'order-top-up',
      expect.objectContaining({
        name: 'Jane Doe',
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '90210',
        country: 'US',
      }),
      expect.any(Object),
    );
  });

  it('rejects invalid billing details when optional address is provided for order invoice', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      topUps: [{ providerOrderId: 'order-top-up', createdAt: new Date('2026-05-02T00:00:00.000Z') }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      fetchOrderInvoice: jest.fn().mockResolvedValue(null),
      generateOrderInvoice: jest.fn(),
    };

    const service = createService(models, billingProviderService);
    try {
      await service.streamBillingItemPdf(workspaceId, 'order-top-up', {
        name: 'Jane Doe',
        address: '123 Mall Road',
        city: 'Lahore',
        state: 'Punjab',
        zipCode: '54000',
        country: 'US',
      });
      throw new Error('expected BadRequestException');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        errorCode: 'billing_invoice_details_invalid',
      });
    }
  });

  it('uses submitted billing details instead of saved profile for one request', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      topUps: [{ providerOrderId: 'order-top-up', createdAt: new Date('2026-05-02T00:00:00.000Z') }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      fetchOrderInvoice: jest.fn().mockResolvedValue(null),
      generateOrderInvoice: mockGenerateOrderInvoice(),
    };
    const billingProfileService = createBillingProfileService({
      hasCompleteProfile: true,
      invoiceDetails: {
        name: 'Saved Profile Name',
        address: 'Saved Address',
        city: 'Lahore',
        zipCode: '54000',
        country: 'PK',
      },
    });

    global.fetch = jest.fn().mockResolvedValue(mockPdfFetchResponse()) as typeof fetch;

    const service = createService(models, billingProviderService, billingProfileService);
    await service.streamBillingItemPdf(workspaceId, 'order-top-up', {
      name: 'Override Name',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '90210',
      country: 'US',
    });

    expect(billingProviderService.generateOrderInvoice).toHaveBeenCalledWith(
      'order-top-up',
      expect.objectContaining({ name: 'Override Name', country: 'US' }),
      expect.any(Object),
    );
    expect(billingProviderService.generateOrderInvoice).not.toHaveBeenCalledWith(
      'order-top-up',
      expect.objectContaining({ name: 'Saved Profile Name' }),
      expect.any(Object),
    );
  });

  it('does not use receipt URL for stored order invoice PDF download', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      billingOrders: [
        {
          providerOrderId: 'order-top-up',
          checkoutType: 'top_up',
          topUpKey: 'ai_credits_1000',
          amountCents: 3000,
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://app.lemonsqueezy.com/receipt/order-top-up',
          receiptUrl: 'https://app.lemonsqueezy.com/receipt/order-top-up',
          orderCreatedAt: new Date('2026-05-02T00:00:00.000Z'),
        },
      ],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      generateOrderInvoice: jest.fn(),
    };
    const billingProfileService = createBillingProfileService();

    const service = createService(models, billingProviderService, billingProfileService);
    await expect(service.streamBillingItemPdf(workspaceId, 'order-top-up')).rejects.toMatchObject({
      response: {
        errorCode: 'billing_invoice_details_required',
      },
    });
    expect(billingProviderService.generateOrderInvoice).not.toHaveBeenCalled();
  });

  it('uses stored Lemon download invoice URL for order PDF without regenerating', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      billingOrders: [
        {
          providerOrderId: 'order-top-up',
          checkoutType: 'top_up',
          topUpKey: 'ai_credits_1000',
          amountCents: 3000,
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://app.lemonsqueezy.com/invoice/download/order-top-up',
          receiptUrl: 'https://app.lemonsqueezy.com/receipt/order-top-up',
          orderCreatedAt: new Date('2026-05-02T00:00:00.000Z'),
        },
      ],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      generateOrderInvoice: jest.fn(),
    };

    global.fetch = jest.fn().mockResolvedValue(mockPdfFetchResponse()) as typeof fetch;

    const service = createService(models, billingProviderService);
    const result = await service.streamBillingItemPdf(workspaceId, 'order-top-up');

    expect(result.mode).toBe('pdf');
    expect(billingProviderService.generateOrderInvoice).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://app.lemonsqueezy.com/invoice/download/order-top-up',
      { redirect: 'follow' },
    );
  });

  it('exposes officialInvoiceUrl and delivery mode on listed invoice rows', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([
        {
          id: 'inv-plan',
          provider: 'lemon_squeezy',
          date: '2026-05-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/plan-page',
          receiptUrl: null,
          description: 'Starter subscription started',
          providerSubscriptionId: 'sub-plan',
          source: 'lemon_subscription_invoice',
        },
      ]),
    };

    const service = createService(models, billingProviderService);
    const rows = await service.listWorkspaceInvoices(workspaceId);
    expect(rows[0]?.officialInvoiceUrl).toBe('https://invoice.example/plan-page');
    expect(rows[0]?.requiresBillingDetails).toBe(false);
    expect(rows[0]?.invoiceDeliveryMode).toBe('provider_url');
  });

  it('marks order rows as requiring billing details when profile is missing', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      topUps: [{ providerOrderId: 'order-top-up', createdAt: new Date('2026-05-02T00:00:00.000Z') }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      fetchOrderInvoice: jest.fn().mockResolvedValue(null),
    };

    const service = createService(models, billingProviderService);
    const rows = await service.listWorkspaceInvoices(workspaceId);
    expect(rows[0]?.requiresBillingDetails).toBe(true);
    expect(rows[0]?.invoiceDeliveryMode).toBe('local_pdf');
  });

  it('exports billing history CSV from all invoice rows', async () => {
    const models = createModels({
      subscription: {
        provider: 'lemon_squeezy',
        providerSubscriptionId: 'sub-plan',
        planKey: 'starter',
      },
      addons: [{ addonKey: 'extra_bot', providerSubscriptionId: 'sub-addon', status: 'active' }],
      topUps: [{ providerOrderId: 'order-top-up', createdAt: new Date('2026-05-02T00:00:00.000Z') }],
    });

    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn(async (subId: string) => {
        if (subId === 'sub-plan') {
          return [
            {
              id: 'inv-plan',
              provider: 'lemon_squeezy',
              date: '2026-05-01T00:00:00.000Z',
              amount: 49,
              amountCents: 4900,
              amountFormatted: '$49.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: 'https://invoice.example/plan',
              receiptUrl: null,
              description: 'Starter subscription started',
              billingReason: 'initial',
              providerSubscriptionId: 'sub-plan',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        if (subId === 'sub-addon') {
          return [
            {
              id: 'inv-addon',
              provider: 'lemon_squeezy',
              date: '2026-05-03T00:00:00.000Z',
              amount: 15,
              amountCents: 1500,
              amountFormatted: '$15.00',
              currency: 'USD',
              status: 'paid',
              invoiceUrl: null,
              receiptUrl: null,
              description: 'Extra AI Agent add-on',
              providerSubscriptionId: 'sub-addon',
              source: 'lemon_subscription_invoice',
            },
          ];
        }
        return [];
      }),
      fetchOrderInvoice: jest.fn().mockResolvedValue(null),
    };

    const service = createService(models, billingProviderService);
    const csv = await service.exportBillingHistoryCsv(workspaceId);

    expect(csv).toContain('$49.00');
    expect(csv).toContain('$15.00');
    expect(csv).toContain('$30.00');
    expect(csv).toContain('Starter');
    expect(csv).toContain('Extra AI Agent add-on');
    expect(csv).toContain('https://invoice.example/plan');
    expect(service.getBillingHistoryCsvFilename()).toBe('assistrio-billing-history.csv');
  });

  it('returns empty list without lemon subscription', async () => {
    const models = createModels({ subscription: null });
    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(true),
      listSubscriptionInvoices: jest.fn(),
    };

    const service = createService(models, billingProviderService);

    const rows = await service.listWorkspaceInvoices(workspaceId);
    expect(rows).toEqual([]);
    expect(billingProviderService.listSubscriptionInvoices).not.toHaveBeenCalled();
  });
});

