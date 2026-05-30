import { BadGatewayException } from '@nestjs/common';
import {
  buildBillingInvoicePdfFilename,
  fetchRemoteInvoicePdf,
  isLikelyOrderInvoicePdfUrl,
  isPdfContentType,
  bufferLooksLikePdf,
} from './billing-invoice-pdf.util';

describe('billing-invoice-pdf.util', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds a stable invoice filename from date and id', () => {
    expect(
      buildBillingInvoicePdfFilename({
        billingItemId: 'inv-plan',
        date: '2026-05-01T00:00:00.000Z',
      }),
    ).toBe('assistrio-invoice-20260501-inv-plan.pdf');
  });

  it('rejects receipt URLs for order PDF download', () => {
    expect(isLikelyOrderInvoicePdfUrl('https://app.lemonsqueezy.com/receipt/order-99')).toBe(false);
    expect(
      isLikelyOrderInvoicePdfUrl('https://app.lemonsqueezy.com/invoice/download/order-99'),
    ).toBe(true);
  });

  it('logs fetch start and result without full URL', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4 test');
    const log = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (key: string) => {
          const normalized = key.toLowerCase();
          if (normalized === 'content-type') return 'application/pdf';
          if (normalized === 'content-length') return String(pdfBytes.length);
          return null;
        },
      },
      arrayBuffer: async () => pdfBytes,
    }) as never;

    await fetchRemoteInvoicePdf('https://invoice.example/plan.pdf', {
      context: { billingItemId: 'inv-plan', billingKind: 'subscription_invoice', requestId: 'req-1' },
      log,
    });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'billing_invoice_pdf_fetch_start',
        urlKind: 'subscription_invoice',
        isLikelyPdfUrl: true,
      }),
    );
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'billing_invoice_pdf_fetch_result',
        startsWithPdfMagic: true,
      }),
    );
    for (const call of log.mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain('https://invoice.example');
    }
  });

  it('fetches remote invoice PDF bytes when content-type is application/pdf', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4 test');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/pdf' : null) },
      arrayBuffer: async () => pdfBytes,
    }) as never;

    const result = await fetchRemoteInvoicePdf('https://invoice.example/plan.pdf');
    expect(result.equals(pdfBytes)).toBe(true);
  });

  it('maps Lemon 401/404 to billing_invoice_pdf_unavailable', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => 'text/html' },
      arrayBuffer: async () => Buffer.from('<html></html>'),
    }) as never;

    try {
      await fetchRemoteInvoicePdf('https://invoice.example/missing.pdf');
      throw new Error('expected BadGatewayException');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayException);
      expect((err as BadGatewayException).getResponse()).toMatchObject({
        errorCode: 'billing_invoice_pdf_unavailable',
      });
    }
  });

  it('rejects HTML/non-PDF content with billing_invoice_pdf_unavailable', async () => {
    const log = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/html' : null) },
      arrayBuffer: async () => Buffer.from('<html>receipt</html>'),
    }) as never;

    await expect(
      fetchRemoteInvoicePdf('https://invoice.example/receipt', {
        context: { billingItemId: 'order-1', billingKind: 'order' },
        log,
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'billing_invoice_pdf_error',
        errorCode: 'billing_invoice_pdf_unavailable',
        billingItemId: 'order-1',
        reason: 'non_pdf_content',
      }),
    );
  });

  it('accepts PDF magic bytes when content-type is missing', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4 test');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => pdfBytes,
    }) as never;

    const result = await fetchRemoteInvoicePdf('https://invoice.example/plan.pdf');
    expect(result.equals(pdfBytes)).toBe(true);
    expect(isPdfContentType(null)).toBe(false);
    expect(bufferLooksLikePdf(pdfBytes)).toBe(true);
  });
});
