import { BadGatewayException } from '@nestjs/common';
import { invoicePdfUrlKind } from './billing-invoice-pdf-log.util';

export type FetchRemoteInvoicePdfContext = {
  requestId?: string;
  billingItemId?: string;
  billingKind?: string;
  providerOrderId?: string | null;
  providerInvoiceId?: string | null;
};

function throwPdfUnavailable(
  log: ((payload: Record<string, unknown>) => void) | undefined,
  context: FetchRemoteInvoicePdfContext | undefined,
  details: Record<string, unknown>,
): never {
  log?.({
    event: 'billing_invoice_pdf_error',
    errorCode: 'billing_invoice_pdf_unavailable',
    requestId: context?.requestId,
    billingItemId: context?.billingItemId,
    billingKind: context?.billingKind,
    providerOrderId: context?.providerOrderId,
    providerInvoiceId: context?.providerInvoiceId,
    ...details,
  });
  throw new BadGatewayException({
    message: 'Invoice PDF is not available right now.',
    errorCode: 'billing_invoice_pdf_unavailable',
  });
}

export function buildBillingInvoicePdfFilename(input: {
  billingItemId: string;
  date?: string | null;
}): string {
  const rawDate = String(input.date ?? '').trim();
  const datePart =
    rawDate.length >= 10 ? rawDate.slice(0, 10).replace(/-/g, '') : 'unknown-date';
  const idPart = String(input.billingItemId ?? 'invoice')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `assistrio-invoice-${datePart}-${idPart || 'invoice'}.pdf`;
}

/** True when a Lemon order URL points at a generated invoice PDF, not a receipt HTML page. */
export function isLikelyOrderInvoicePdfUrl(url: string): boolean {
  const normalized = String(url ?? '').trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('/receipt')) return false;
  if (normalized.includes('download_invoice') || normalized.includes('download-invoice')) {
    return true;
  }
  if (normalized.includes('/download/')) return true;
  if (normalized.endsWith('.pdf')) return true;
  return false;
}

export function isPdfContentType(contentType: string | null | undefined): boolean {
  const normalized = String(contentType ?? '').trim().toLowerCase();
  return normalized.includes('application/pdf');
}

export function bufferLooksLikePdf(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString('utf8') === '%PDF';
}

export async function fetchRemoteInvoicePdf(
  url: string,
  options?: {
    context?: FetchRemoteInvoicePdfContext;
    log?: (payload: Record<string, unknown>) => void;
  },
): Promise<Buffer> {
  const target = String(url ?? '').trim();
  const context = options?.context;
  const log = options?.log;
  const billingKind = context?.billingKind;
  const urlKind = invoicePdfUrlKind(billingKind);
  const isLikelyPdfUrl =
    billingKind !== 'order' ? Boolean(target) : isLikelyOrderInvoicePdfUrl(target);

  log?.({
    event: 'billing_invoice_pdf_fetch_start',
    requestId: context?.requestId,
    billingItemId: context?.billingItemId,
    billingKind,
    urlKind,
    isLikelyPdfUrl,
  });

  if (!target) {
    log?.({
      event: 'billing_invoice_pdf_fetch_result',
      requestId: context?.requestId,
      billingItemId: context?.billingItemId,
      errorCode: 'billing_invoice_pdf_unavailable',
      reason: 'missing_url',
    });
    throwPdfUnavailable(log, context, { reason: 'missing_url' });
  }

  let res: Response;
  try {
    res = await fetch(target, { redirect: 'follow' });
  } catch {
    log?.({
      event: 'billing_invoice_pdf_fetch_result',
      requestId: context?.requestId,
      billingItemId: context?.billingItemId,
      errorCode: 'billing_invoice_pdf_unavailable',
      reason: 'network_error',
    });
    throwPdfUnavailable(log, context, { reason: 'network_error' });
  }

  const contentType = res.headers.get('content-type');
  const contentLengthHeader = res.headers.get('content-length');
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;

  if (!res.ok) {
    log?.({
      event: 'billing_invoice_pdf_fetch_result',
      requestId: context?.requestId,
      billingItemId: context?.billingItemId,
      status: res.status,
      contentType,
      contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
      startsWithPdfMagic: false,
      errorCode: 'billing_invoice_pdf_unavailable',
      reason: 'http_error',
    });
    throwPdfUnavailable(log, context, {
      reason: 'http_error',
      status: res.status,
      contentType,
    });
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const startsWithPdfMagic = bufferLooksLikePdf(buffer);

  if (buffer.length === 0) {
    log?.({
      event: 'billing_invoice_pdf_fetch_result',
      requestId: context?.requestId,
      billingItemId: context?.billingItemId,
      status: res.status,
      contentType,
      contentLength: 0,
      startsWithPdfMagic: false,
      errorCode: 'billing_invoice_pdf_unavailable',
      reason: 'empty_body',
    });
    throwPdfUnavailable(log, context, {
      reason: 'empty_body',
      status: res.status,
      contentType,
    });
  }

  if (!isPdfContentType(contentType) && !startsWithPdfMagic) {
    log?.({
      event: 'billing_invoice_pdf_fetch_result',
      requestId: context?.requestId,
      billingItemId: context?.billingItemId,
      status: res.status,
      contentType,
      contentLength: buffer.length,
      startsWithPdfMagic: false,
      errorCode: 'billing_invoice_pdf_unavailable',
      reason: 'non_pdf_content',
    });
    throwPdfUnavailable(log, context, {
      reason: 'non_pdf_content',
      status: res.status,
      contentType,
    });
  }

  log?.({
    event: 'billing_invoice_pdf_fetch_result',
    requestId: context?.requestId,
    billingItemId: context?.billingItemId,
    status: res.status,
    contentType,
    contentLength: buffer.length,
    startsWithPdfMagic,
  });

  return buffer;
}
