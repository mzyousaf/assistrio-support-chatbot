import { buildBillingHistoryCsv } from './billing-history-csv.util';
import type { ProviderInvoiceRow } from './billing-invoice.types';

describe('billing-history-csv.util', () => {
  it('builds CSV with plan, add-on, and top-up rows including missing invoice URLs', () => {
    const rows: ProviderInvoiceRow[] = [
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
        itemType: 'plan',
        itemKey: 'starter',
        itemName: 'Starter',
        billingKind: 'subscription_invoice',
        billingInterval: 'monthly',
      },
      {
        id: 'inv-addon',
        provider: 'lemon_squeezy',
        date: '2026-05-03T00:00:00.000Z',
        amount: 15,
        amountCents: 1500,
        amountFormatted: '$15.00',
        currency: 'USD',
        status: 'paid',
        invoiceUrl: 'https://invoice.example/addon',
        receiptUrl: null,
        description: 'Extra AI Agent add-on',
        itemType: 'addon',
        itemKey: 'extra_bot',
        itemName: 'Extra AI Agent add-on',
        billingKind: 'subscription_invoice',
        billingInterval: 'yearly',
      },
      {
        id: 'order-top-up',
        provider: 'lemon_squeezy',
        date: '2026-05-02T00:00:00.000Z',
        amount: 30,
        amountCents: 3000,
        amountFormatted: '$30.00',
        currency: 'USD',
        status: 'paid',
        invoiceUrl: null,
        receiptUrl: 'https://receipt.example/top-up',
        description: '1,000 AI credits top-up',
        itemType: 'top_up',
        itemKey: 'ai_credits_1000',
        itemName: '1,000 AI credits',
        billingKind: 'order',
      },
    ];

    const csv = buildBillingHistoryCsv(rows);
    expect(csv).toContain(
      'Date,Item,Description,Type,Billing cadence,Amount,Currency,Status,Provider,Invoice/Receipt URL',
    );
    expect(csv).toContain('Monthly');
    expect(csv).toContain('Annually');
    expect(csv).toContain('One-time');
    expect(csv).toContain('$49.00');
    expect(csv).toContain('$15.00');
    expect(csv).toContain('$30.00');
    expect(csv).toContain('Starter');
    expect(csv).toContain('Extra AI Agent add-on');
    expect(csv).toContain('https://invoice.example/plan');
    expect(csv).toContain('https://receipt.example/top-up');
    expect(csv.split('\r\n').length).toBe(4);
  });

  it('leaves invoice URL empty when neither invoice nor receipt URL exists', () => {
    const csv = buildBillingHistoryCsv([
      {
        id: 'order-1',
        provider: 'lemon_squeezy',
        date: '2026-05-04T00:00:00.000Z',
        amount: 30,
        amountCents: 3000,
        amountFormatted: '$30.00',
        currency: 'USD',
        status: 'paid',
        invoiceUrl: null,
        receiptUrl: null,
        description: '1,000 AI credits top-up',
        itemType: 'top_up',
        itemName: '1,000 AI credits',
        billingKind: 'order',
      },
    ]);

    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toContain('One-time');
    expect(dataLine?.endsWith(',paid,Lemon Squeezy,')).toBe(true);
  });
});
