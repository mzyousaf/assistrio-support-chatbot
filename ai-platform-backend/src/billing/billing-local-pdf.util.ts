import type { BillingOrderInvoiceDetails } from './billing-invoice-download.types';
import type { ProviderInvoiceRow } from './billing-invoice.types';

export type LocalBillingPdfContext = {
  workspaceName: string;
  workspaceId: string;
  customerName?: string;
  customerEmail?: string;
  billingDetails?: BillingOrderInvoiceDetails;
};

export function buildLocalBillingPdfFilename(billingItemId: string): string {
  const safeId = String(billingItemId ?? 'item')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `assistrio-billing-${safeId || 'item'}.pdf`;
}

export function formatBillingPdfDate(isoDate: string): string {
  const parsed = new Date(String(isoDate ?? ''));
  if (Number.isNaN(parsed.getTime())) return String(isoDate ?? '').trim() || 'Unknown date';
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function sanitizePdfText(value: string): string {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfString(value: string): string {
  return sanitizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapPdfLine(value: string, maxLength = 88): string[] {
  const text = sanitizePdfText(value);
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildPdfLines(input: {
  row: ProviderInvoiceRow;
  context: LocalBillingPdfContext;
}): string[] {
  const { row, context } = input;
  const billingKind = row.billingKind ?? 'subscription_invoice';
  const documentTitle = billingKind === 'order' ? 'Receipt' : 'Invoice';
  const itemName = row.itemName?.trim() || row.description?.trim() || 'Payment';
  const description = row.description?.trim() || itemName;
  const providerReferenceId =
    billingKind === 'order'
      ? String(row.providerOrderId ?? row.id).trim()
      : String(row.id).trim();

  const lines: string[] = [
    'Assistrio',
    documentTitle,
    '',
    `Item: ${itemName}`,
    `Description: ${description}`,
    `Date: ${formatBillingPdfDate(row.date)}`,
    `Amount: ${row.amountFormatted}`,
    `Currency: ${String(row.currency ?? 'USD').toUpperCase()}`,
    `Status: ${row.status}`,
    '',
    `Workspace: ${context.workspaceName}`,
    `Workspace ID: ${context.workspaceId}`,
  ];

  if (context.customerName) {
    lines.push(`Customer: ${context.customerName}`);
  }
  if (context.customerEmail) {
    lines.push(`Email: ${context.customerEmail}`);
  }

  const details = context.billingDetails;
  if (details) {
    lines.push('', 'Billing address:');
    lines.push(details.name);
    lines.push(details.address);
    const cityLine = [details.city, details.state, details.zipCode].filter(Boolean).join(', ');
    if (cityLine) lines.push(cityLine);
    if (details.country) lines.push(details.country);
  }

  lines.push(
    '',
    'Payment provider: Lemon Squeezy',
  );
  if (providerReferenceId) {
    lines.push(
      billingKind === 'order'
        ? `Provider order ID: ${providerReferenceId}`
        : `Provider invoice ID: ${providerReferenceId}`,
    );
  }
  lines.push('', 'Payment processed by Lemon Squeezy.');

  return lines.flatMap((line) => wrapPdfLine(line));
}

export function generateLocalBillingPdf(input: {
  row: ProviderInvoiceRow;
  context: LocalBillingPdfContext;
}): Buffer {
  const lines = buildPdfLines(input);
  const fontSize = 11;
  const lineHeight = 16;
  const startX = 50;
  const startY = 750;

  const contentStream = lines
    .map((line, index) => {
      const y = startY - index * lineHeight;
      return `BT /F1 ${fontSize} Tf ${startX} ${y} Td (${escapePdfString(line)}) Tj ET`;
    })
    .join('\n');

  const streamLength = Buffer.byteLength(contentStream, 'utf8');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}
