import {
  resolveBillingInvoiceDeliveryMode,
  resolveProviderDirectPdfUrl,
  resolveProviderHostedInvoiceUrl,
} from './billing-invoice-provider-url.util';

describe('billing-invoice-provider-url.util', () => {
  it('returns hosted invoice URL for Lemon HTML invoice pages', () => {
    expect(
      resolveProviderHostedInvoiceUrl({
        invoiceUrl: 'https://app.lemonsqueezy.com/my-orders/inv-plan',
        receiptUrl: null,
        source: 'lemon_subscription_invoice',
      }),
    ).toEqual({
      url: 'https://app.lemonsqueezy.com/my-orders/inv-plan',
      source: 'lemon_subscription_invoice',
    });
  });

  it('does not treat direct PDF URLs as hosted provider pages', () => {
    expect(
      resolveProviderHostedInvoiceUrl({
        invoiceUrl: 'https://app.lemonsqueezy.com/invoice/download/order-99',
        receiptUrl: null,
        source: 'lemon_order',
      }),
    ).toBeNull();
    expect(
      resolveProviderDirectPdfUrl({
        invoiceUrl: 'https://app.lemonsqueezy.com/invoice/download/order-99',
        receiptUrl: null,
      }),
    ).toBe('https://app.lemonsqueezy.com/invoice/download/order-99');
  });

  it('prefers invoiceUrl over receiptUrl for hosted pages', () => {
    expect(
      resolveProviderHostedInvoiceUrl({
        invoiceUrl: 'https://app.lemonsqueezy.com/my-orders/inv-plan',
        receiptUrl: 'https://app.lemonsqueezy.com/receipt/order-99',
        source: 'lemon_subscription_invoice',
      })?.url,
    ).toBe('https://app.lemonsqueezy.com/my-orders/inv-plan');
  });

  it('uses receiptUrl when invoiceUrl is missing', () => {
    expect(
      resolveProviderHostedInvoiceUrl({
        invoiceUrl: null,
        receiptUrl: 'https://app.lemonsqueezy.com/receipt/order-99',
        source: 'lemon_order',
      }),
    ).toEqual({
      url: 'https://app.lemonsqueezy.com/receipt/order-99',
      source: 'lemon_order',
    });
  });

  it('classifies delivery mode', () => {
    expect(
      resolveBillingInvoiceDeliveryMode({
        invoiceUrl: 'https://app.lemonsqueezy.com/my-orders/inv-plan',
        receiptUrl: null,
        source: 'lemon_subscription_invoice',
      }),
    ).toBe('provider_url');

    expect(
      resolveBillingInvoiceDeliveryMode({
        invoiceUrl: 'https://app.lemonsqueezy.com/invoice/download/order-99',
        receiptUrl: null,
        source: 'lemon_order',
      }),
    ).toBe('direct_pdf');

    expect(
      resolveBillingInvoiceDeliveryMode({
        invoiceUrl: null,
        receiptUrl: null,
        source: 'local_top_up',
      }),
    ).toBe('local_pdf');
  });
});
