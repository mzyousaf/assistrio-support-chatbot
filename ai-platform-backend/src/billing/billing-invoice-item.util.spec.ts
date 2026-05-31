import {
  buildSubscriptionInvoiceRowId,
  enrichInvoiceRow,
  mapInvoiceItemDescription,
  resolveInvoiceItemMatch,
  variantIdToItemKey,
} from './billing-invoice-item.util';
import type { LemonSqueezyBillingConfig } from './billing-config.util';

describe('billing-invoice-item.util', () => {
  const lemonConfig: LemonSqueezyBillingConfig = {
    apiKey: 'key',
    storeId: 'store',
    webhookSecret: 'secret',
    customerAppBaseUrl: 'https://app.example.com',
    variantIds: {
      starter: { monthly: '111', yearly: '112' },
      pro: { monthly: '222', yearly: '223' },
      extra_bot: { monthly: '333', yearly: '334' },
      remove_branding: { monthly: '444', yearly: '445' },
      ai_credits_1000: '777',
      ai_credits_auto_topup: '888',
    },
  };

  const addonKeyBySubscriptionId = new Map<string, string>([
    ['sub-addon-bot', 'extra_bot'],
    ['sub-addon-brand', 'remove_branding'],
    ['sub-addon-legacy-kb', 'kb_storage_5mb'],
  ]);
  const topUpOrderIds = new Set<string>(['order-top-up-1']);

  it('maps starter/pro initial, renewal, and updated descriptions', () => {
    expect(mapInvoiceItemDescription({ itemKey: 'starter', billingReason: 'initial' })).toBe(
      'Starter subscription started',
    );
    expect(mapInvoiceItemDescription({ itemKey: 'starter', billingReason: 'renewal' })).toBe(
      'Starter subscription renewal',
    );
    expect(mapInvoiceItemDescription({ itemKey: 'starter', billingReason: 'updated' })).toBe(
      'Starter subscription updated',
    );
    expect(mapInvoiceItemDescription({ itemKey: 'pro', billingReason: 'initial' })).toBe(
      'Pro subscription started',
    );
    expect(mapInvoiceItemDescription({ itemKey: 'pro', billingReason: 'renewal' })).toBe(
      'Pro subscription renewal',
    );
  });

  it('maps add-on, legacy KB, and top-up descriptions', () => {
    expect(mapInvoiceItemDescription({ itemKey: 'extra_bot' })).toBe('Extra AI Agent add-on');
    expect(mapInvoiceItemDescription({ itemKey: 'remove_branding' })).toBe('Remove branding add-on');
    expect(mapInvoiceItemDescription({ itemKey: 'legacy_kb_storage' })).toBe(
      'Legacy trained knowledge add-on',
    );
    expect(mapInvoiceItemDescription({ itemKey: 'kb_storage_5mb' })).toBe(
      'Legacy trained knowledge add-on',
    );
    expect(mapInvoiceItemDescription({ itemKey: 'ai_credits_1000' })).toBe('1,000 AI credits top-up');
  });

  it('resolves item key from non-empty variant id only', () => {
    expect(variantIdToItemKey('333', lemonConfig)).toBe('extra_bot');
    expect(variantIdToItemKey('777', lemonConfig)).toBe('ai_credits_1000');
    expect(variantIdToItemKey('', lemonConfig)).toBeUndefined();
  });

  it('matches main plan subscription by providerSubscriptionId', () => {
    const match = resolveInvoiceItemMatch({
      row: {
        providerSubscriptionId: 'sub-plan',
        providerVariantId: '111',
        providerOrderId: null,
        billingReason: 'initial',
      },
      planSubscriptionId: 'sub-plan',
      planKey: 'starter',
      addonKeyBySubscriptionId,
      topUpOrderIds,
      lemonConfig,
    });

    expect(match.itemType).toBe('plan');
    expect(match.itemKey).toBe('starter');
    expect(match.itemName).toBe('Starter');
    expect(match.description).toBe('Starter subscription started');
    expect(match.description).not.toContain('trained knowledge');
  });

  it('does not map plan subscription invoice to add-on when subscription ids differ', () => {
    const match = resolveInvoiceItemMatch({
      row: {
        providerSubscriptionId: 'sub-plan',
        providerVariantId: '222',
        providerOrderId: null,
        billingReason: 'initial',
      },
      planSubscriptionId: 'sub-plan',
      planKey: 'pro',
      addonKeyBySubscriptionId,
      topUpOrderIds,
      lemonConfig,
      fetchHint: { kind: 'plan', planKey: 'pro', providerSubscriptionId: 'sub-plan' },
    });

    expect(match.itemType).toBe('plan');
    expect(match.itemKey).toBe('pro');
    expect(match.itemName).toBe('Pro');
    expect(match.description).toBe('Pro subscription started');
  });

  it('labels legacy KB add-on invoices without active product item type', () => {
    const match = resolveInvoiceItemMatch({
      row: {
        providerSubscriptionId: 'sub-addon-legacy-kb',
        providerVariantId: null,
        providerOrderId: null,
        billingReason: 'initial',
      },
      planSubscriptionId: 'sub-plan',
      planKey: 'starter',
      addonKeyBySubscriptionId,
      topUpOrderIds,
      lemonConfig,
      fetchHint: {
        kind: 'addon',
        addonKey: 'kb_storage_5mb',
        providerSubscriptionId: 'sub-addon-legacy-kb',
      },
    });

    expect(match.itemType).toBe('unknown');
    expect(match.itemKey).toBe('legacy_kb_storage');
    expect(match.itemName).toBe('Legacy KB storage add-on');
    expect(match.description).toBe('Legacy trained knowledge add-on');
  });

  it('matches extra bot and remove branding add-on invoices', () => {
    const extraBot = resolveInvoiceItemMatch({
      row: {
        providerSubscriptionId: 'sub-addon-bot',
        providerVariantId: '333',
        providerOrderId: null,
        billingReason: 'renewal',
      },
      planSubscriptionId: 'sub-plan',
      planKey: 'starter',
      addonKeyBySubscriptionId,
      topUpOrderIds,
      lemonConfig,
      fetchHint: { kind: 'addon', addonKey: 'extra_bot', providerSubscriptionId: 'sub-addon-bot' },
    });
    expect(extraBot.description).toBe('Extra AI Agent add-on');

    const branding = resolveInvoiceItemMatch({
      row: {
        providerSubscriptionId: 'sub-addon-brand',
        providerVariantId: '444',
        providerOrderId: null,
        billingReason: 'renewal',
      },
      planSubscriptionId: 'sub-plan',
      planKey: 'starter',
      addonKeyBySubscriptionId,
      topUpOrderIds,
      lemonConfig,
      fetchHint: { kind: 'addon', addonKey: 'remove_branding', providerSubscriptionId: 'sub-addon-brand' },
    });
    expect(branding.description).toBe('Remove branding add-on');
  });

  it('matches top-up by providerOrderId', () => {
    const match = resolveInvoiceItemMatch({
      row: {
        providerSubscriptionId: null,
        providerVariantId: '777',
        providerOrderId: 'order-top-up-1',
        billingReason: 'manual',
      },
      planSubscriptionId: 'sub-plan',
      planKey: 'starter',
      addonKeyBySubscriptionId,
      topUpOrderIds,
      lemonConfig,
    });

    expect(match.itemType).toBe('top_up');
    expect(match.itemKey).toBe('ai_credits_1000');
    expect(match.itemName).toBe('1,000 AI credits');
    expect(match.description).toBe('1,000 AI credits top-up');
  });

  it('builds stable subscription invoice row ids', () => {
    expect(
      buildSubscriptionInvoiceRowId({
        id: 'inv-plan-1',
        source: 'lemon_subscription_invoice',
        providerSubscriptionId: 'sub-plan',
      }),
    ).toBe('lemon_subscription_invoice:inv-plan-1:sub-plan');
    expect(
      buildSubscriptionInvoiceRowId({
        id: 'inv-plan-1',
        source: 'lemon_subscription_invoice',
        providerSubscriptionId: 'sub-addon-bot',
      }),
    ).toBe('lemon_subscription_invoice:inv-plan-1:sub-addon-bot');
  });

  it('enriches invoice row with itemType and description', () => {
    const row = enrichInvoiceRow(
      {
        id: 'inv-1',
        provider: 'lemon_squeezy',
        date: '2026-05-01T00:00:00.000Z',
        amount: 49,
        amountCents: 4900,
        amountFormatted: '$49.00',
        currency: 'USD',
        status: 'paid',
        invoiceUrl: 'https://invoice.example/1',
        receiptUrl: null,
        description: 'initial',
      },
      {
        itemType: 'plan',
        itemKey: 'starter',
        itemName: 'Starter',
        description: 'Starter subscription started',
      },
      { source: 'lemon_subscription_invoice' },
    );

    expect(row.itemType).toBe('plan');
    expect(row.itemKey).toBe('starter');
    expect(row.description).toBe('Starter subscription started');
    expect(row.source).toBe('lemon_subscription_invoice');
  });
});
