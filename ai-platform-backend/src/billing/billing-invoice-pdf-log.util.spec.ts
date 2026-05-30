import {
  billingInvoicePdfQueryMetadata,
  extractLemonInvoiceGenerationErrorFields,
  logPayloadContainsSensitiveData,
} from './billing-invoice-pdf-log.util';

describe('billing-invoice-pdf-log.util', () => {
  it('extracts safe Lemon error title and detail', () => {
    const fields = extractLemonInvoiceGenerationErrorFields(
      JSON.stringify({
        errors: [
          {
            title: 'Invalid state',
            detail: 'The state field is invalid.',
            source: { pointer: '/data/attributes/state' },
          },
        ],
      }),
    );

    expect(fields.lemonErrorTitle).toBe('Invalid state');
    expect(fields.lemonErrorDetail).toBe('The state field is invalid.');
    expect(fields.reason).toContain('state field is invalid');
  });

  it('derives query metadata without address fields', () => {
    expect(
      billingInvoicePdfQueryMetadata({
        name: 'Jane Doe',
        address: '123 Mall Road',
        city: 'Lahore',
        state: 'Punjab',
        zipCode: '54000',
        country: 'pk',
      }),
    ).toEqual({
      hasQueryDetails: true,
      country: 'PK',
      hasState: true,
      zipCodePresent: true,
    });
  });

  it('flags sensitive log payloads', () => {
    expect(
      logPayloadContainsSensitiveData(
        JSON.stringify({
          event: 'lemon_generate_order_invoice_request',
          authorization: 'Bearer secret-key',
        }),
      ),
    ).toBe(true);

    expect(
      logPayloadContainsSensitiveData(
        JSON.stringify({
          event: 'billing_invoice_pdf_fetch_start',
          urlKind: 'order_invoice',
          isLikelyPdfUrl: true,
        }),
      ),
    ).toBe(false);
  });
});
