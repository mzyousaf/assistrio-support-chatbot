import {
  formatInvoiceAmountFormatted,
  mapInvoiceBillingReasonDescription,
  normalizeProviderInvoiceRow,
  parseAmountCents,
  resolveLemonInvoiceUrl,
  resolveLemonSubscriptionInvoiceUrl,
} from './billing-invoice-format.util';

describe('billing-invoice-format.util', () => {
  it('formats 4900 cents as $49.00', () => {
    expect(formatInvoiceAmountFormatted(4900, 'USD')).toBe('$49.00');
  });

  it('formats 3000 cents as $30.00', () => {
    expect(formatInvoiceAmountFormatted(3000, 'USD')).toBe('$30.00');
  });

  it('maps billing_reason initial to Subscription started', () => {
    expect(mapInvoiceBillingReasonDescription('initial')).toBe('Subscription started');
    expect(mapInvoiceBillingReasonDescription('initial')).not.toBe('initial');
  });

  it('maps billing_reason renewal', () => {
    expect(mapInvoiceBillingReasonDescription('renewal')).toBe('Subscription renewal');
  });

  it('uses plan label when plan key known', () => {
    expect(mapInvoiceBillingReasonDescription('initial', 'starter')).toBe('Starter subscription started');
    expect(mapInvoiceBillingReasonDescription('renewal', 'pro')).toBe('Pro subscription renewal');
  });

  it('resolves subscription invoice URL from attributes.urls.invoice_url only', () => {
    expect(
      resolveLemonSubscriptionInvoiceUrl({
        urls: {
          invoice_url: 'https://app.lemonsqueezy.com/my-url/invoice/abc',
          receipt: 'https://app.lemonsqueezy.com/receipt/abc',
        },
      }),
    ).toBe('https://app.lemonsqueezy.com/my-url/invoice/abc');
    expect(
      resolveLemonSubscriptionInvoiceUrl({
        urls: { receipt: 'https://app.lemonsqueezy.com/receipt/abc' },
      }),
    ).toBeNull();
  });

  it('resolves invoice URL from attributes.urls.invoice_url', () => {
    expect(
      resolveLemonInvoiceUrl({
        urls: { invoice_url: 'https://app.lemonsqueezy.com/my-url/invoice/abc' },
      }),
    ).toBe('https://app.lemonsqueezy.com/my-url/invoice/abc');
  });

  it('normalizes row with amountFormatted', () => {
    const row = normalizeProviderInvoiceRow({
      id: 'inv-1',
      provider: 'lemon_squeezy',
      date: '2026-05-01T00:00:00.000Z',
      amountCents: 4900,
      currency: 'USD',
      status: 'paid',
      invoiceUrl: 'https://invoice.example/1',
      receiptUrl: null,
      description: 'Subscription started',
    });
    expect(row.amountFormatted).toBe('$49.00');
    expect(row.amountCents).toBe(4900);
    expect(row.amount).toBe(49);
  });
});
