import { describe, expect, it } from 'vitest';
import { billingInvoiceActionLabel } from '@/lib/billingInvoiceActionLabel';
import type { WorkspaceBillingInvoiceRow } from '@/api/types';

function buildRow(
  overrides?: Partial<WorkspaceBillingInvoiceRow>,
): WorkspaceBillingInvoiceRow {
  return {
    id: 'inv-1',
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
    ...overrides,
  };
}

describe('billingInvoiceActionLabel', () => {
  it('uses Open invoice for provider hosted pages', () => {
    expect(
      billingInvoiceActionLabel(
        buildRow({ invoiceDeliveryMode: 'provider_url' }),
      ),
    ).toBe('Open invoice');
  });

  it('uses Download PDF for direct PDF and local fallback rows', () => {
    expect(
      billingInvoiceActionLabel(
        buildRow({ invoiceDeliveryMode: 'direct_pdf' }),
      ),
    ).toBe('Download PDF');
    expect(
      billingInvoiceActionLabel(
        buildRow({ invoiceDeliveryMode: 'local_pdf' }),
      ),
    ).toBe('Download PDF');
  });
});
