import {
  isCompleteOrderInvoiceDetails,
  normalizeOrderInvoiceDetails,
  parseOrderInvoiceDetails,
  validateOrderInvoiceAddressRules,
} from './billing-invoice-download.util';

describe('billing-invoice-download.util', () => {
  it('requires core billing fields for order invoice generation', () => {
    expect(
      isCompleteOrderInvoiceDetails({
        name: 'Jane Doe',
        address: '123 Main St',
        city: 'Anytown',
        zipCode: '90210',
        country: 'US',
      }),
    ).toBe(false);
  });

  it('requires state for US and CA', () => {
    expect(
      isCompleteOrderInvoiceDetails({
        name: 'Jane Doe',
        address: '123 Main St',
        city: 'Anytown',
        zipCode: '90210',
        country: 'US',
        state: 'CA',
      }),
    ).toBe(true);

    expect(
      isCompleteOrderInvoiceDetails({
        name: 'Jane Doe',
        address: '123 Main St',
        city: 'Toronto',
        zipCode: 'M5V 2T6',
        country: 'CA',
        state: 'ON',
      }),
    ).toBe(true);
  });

  it('accepts Pakistan address without requiring US state rules', () => {
    const details = normalizeOrderInvoiceDetails({
      name: 'Jane Doe',
      address: '123 Mall Road',
      city: 'Lahore',
      state: 'Punjab',
      zipCode: '54000',
      country: 'pk',
    });

    expect(details).toEqual({
      name: 'Jane Doe',
      address: '123 Mall Road',
      city: 'Lahore',
      state: 'Punjab',
      zipCode: '54000',
      country: 'PK',
      notes: undefined,
      locale: undefined,
    });
    expect(validateOrderInvoiceAddressRules(details!)).toBeNull();
    expect(parseOrderInvoiceDetails(details!).ok).toBe(true);
  });

  it('rejects US country with non-US state', () => {
    const parsed = parseOrderInvoiceDetails({
      name: 'Jane Doe',
      address: '123 Mall Road',
      city: 'Lahore',
      state: 'Punjab',
      zipCode: '54000',
      country: 'US',
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errorCode).toBe('billing_invoice_details_invalid');
      expect(parsed.message).toContain('valid US state');
    }
  });

  it('normalizes complete US billing details to uppercase country and state code', () => {
    expect(
      normalizeOrderInvoiceDetails({
        name: ' Jane Doe ',
        address: ' 123 Main St ',
        city: ' Anytown ',
        state: ' ca ',
        zipCode: ' 90210 ',
        country: ' us ',
        notes: ' PO 123 ',
      }),
    ).toEqual({
      name: 'Jane Doe',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '90210',
      country: 'US',
      notes: 'PO 123',
      locale: undefined,
    });
  });

  it('logs safe parse metadata for invalid US state', () => {
    const log = jest.fn();
    parseOrderInvoiceDetails(
      {
        name: 'Jane Doe',
        address: '123 Mall Road',
        city: 'Lahore',
        state: 'Punjab',
        zipCode: '54000',
        country: 'US',
      },
      { billingItemId: 'order-top-up', requestId: 'req-parse-1', log },
    );

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'billing_invoice_details_parsed',
        billingItemId: 'order-top-up',
        country: 'US',
        stateProvided: true,
        zipCodePresent: true,
        stateRequired: true,
        valid: false,
        validationErrorCode: 'billing_invoice_details_invalid',
      }),
    );
    expect(JSON.stringify(log.mock.calls[0][0])).not.toContain('123 Mall Road');
    expect(JSON.stringify(log.mock.calls[0][0])).not.toContain('Punjab');
  });
});
