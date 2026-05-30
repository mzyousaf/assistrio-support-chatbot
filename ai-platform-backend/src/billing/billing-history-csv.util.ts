import type { ProviderInvoiceRow } from './billing-invoice.types';

const CSV_HEADERS = [
  'Date',
  'Item',
  'Description',
  'Type',
  'Amount',
  'Currency',
  'Status',
  'Provider',
  'Invoice/Receipt URL',
] as const;

function escapeCsvCell(value: string): string {
  const v = String(value ?? '');
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function formatCsvDate(isoDate: string): string {
  const raw = String(isoDate ?? '').trim();
  if (raw.length >= 10) return raw.slice(0, 10);
  return raw;
}

function resolveHistoryType(row: ProviderInvoiceRow): string {
  switch (row.itemType) {
    case 'plan':
      return 'Subscription';
    case 'addon':
      return 'Add-on';
    case 'top_up':
      return 'Top-up';
    default:
      if (row.billingKind === 'subscription_invoice') return 'Subscription invoice';
      if (row.billingKind === 'order') return 'Order';
      return 'Payment';
  }
}

function resolveProviderLabel(provider: ProviderInvoiceRow['provider']): string {
  if (provider === 'lemon_squeezy') return 'Lemon Squeezy';
  return String(provider ?? '');
}

function resolveInvoiceOrReceiptUrl(row: ProviderInvoiceRow): string {
  return row.invoiceUrl?.trim() || row.receiptUrl?.trim() || '';
}

function resolveItemLabel(row: ProviderInvoiceRow): string {
  return row.itemName?.trim() || row.description?.trim() || 'Payment';
}

function resolveDescription(row: ProviderInvoiceRow): string {
  const item = resolveItemLabel(row);
  const description = row.description?.trim() ?? '';
  if (!description || description === item) return description;
  return description;
}

function resolveAmount(row: ProviderInvoiceRow): string {
  if (row.amountFormatted?.trim()) return row.amountFormatted.trim();
  if (row.amountCents != null) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: row.currency || 'USD',
    }).format(row.amountCents / 100);
  }
  return String(row.amount ?? '');
}

export function buildBillingHistoryCsv(rows: ProviderInvoiceRow[]): string {
  const lines = [CSV_HEADERS.map(escapeCsvCell).join(',')];

  for (const row of rows) {
    lines.push(
      [
        formatCsvDate(row.date),
        resolveItemLabel(row),
        resolveDescription(row),
        resolveHistoryType(row),
        resolveAmount(row),
        row.currency || 'USD',
        row.status,
        resolveProviderLabel(row.provider),
        resolveInvoiceOrReceiptUrl(row),
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }

  return `\uFEFF${lines.join('\r\n')}`;
}

export const BILLING_HISTORY_CSV_FILENAME = 'assistrio-billing-history.csv';
