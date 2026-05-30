import { generateLocalBillingPdf, buildLocalBillingPdfFilename } from './billing-local-pdf.util';
import type { ProviderInvoiceRow } from './billing-invoice.types';

function buildRow(overrides?: Partial<ProviderInvoiceRow>): ProviderInvoiceRow {
  return {
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
    billingKind: 'subscription_invoice',
    ...overrides,
  };
}

describe('billing-local-pdf.util', () => {
  it('builds attachment filename from billing item id', () => {
    expect(buildLocalBillingPdfFilename('inv-plan')).toBe('assistrio-billing-inv-plan.pdf');
  });

  it('generates a valid PDF with subscription amount', () => {
    const buffer = generateLocalBillingPdf({
      row: buildRow(),
      context: {
        workspaceName: 'Acme Workspace',
        workspaceId: '507f1f77bcf86cd799439011',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
      },
    });

    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    const text = buffer.toString('utf8');
    expect(text).toContain('$49.00');
    expect(text).toContain('Starter');
    expect(text).toContain('Lemon Squeezy');
    expect(text).not.toContain('https://invoice.example');
  });

  it('generates top-up receipt PDF with order amount', () => {
    const buffer = generateLocalBillingPdf({
      row: buildRow({
        id: 'order-top-up',
        amount: 30,
        amountCents: 3000,
        amountFormatted: '$30.00',
        itemType: 'top_up',
        itemName: '1,000 AI credits',
        description: '1,000 AI credits top-up',
        billingKind: 'order',
        providerOrderId: 'order-top-up',
      }),
      context: {
        workspaceName: 'Acme Workspace',
        workspaceId: '507f1f77bcf86cd799439011',
      },
    });

    const text = buffer.toString('utf8');
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(text).toContain('$30.00');
    expect(text).toContain('Receipt');
    expect(text).toContain('order-top-up');
  });
});
