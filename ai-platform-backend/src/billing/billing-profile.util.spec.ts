import {
  isCompleteBillingProfileInput,
  parseBillingProfilePatch,
  profileRecordToInvoiceDetails,
} from './billing-profile.util';

describe('billing-profile.util', () => {
  it('uppercases country on save', () => {
    const parsed = parseBillingProfilePatch({
      name: 'Acme Inc',
      address: '123 Mall Road',
      city: 'Lahore',
      zipCode: '54000',
      country: 'pk',
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.profile.country).toBe('PK');
  });

  it('requires state for US addresses', () => {
    const parsed = parseBillingProfilePatch({
      name: 'Acme Inc',
      address: '123 Main St',
      city: 'Los Angeles',
      zipCode: '90001',
      country: 'US',
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errorCode).toBe('billing_profile_invalid');
  });

  it('requires state for CA addresses', () => {
    const parsed = parseBillingProfilePatch({
      name: 'Acme Inc',
      address: '100 King St W',
      city: 'Toronto',
      zipCode: 'M5X 1A9',
      country: 'CA',
    });
    expect(parsed.ok).toBe(false);
  });

  it('does not require state for PK addresses', () => {
    const parsed = parseBillingProfilePatch({
      name: 'Acme Inc',
      address: '123 Mall Road',
      city: 'Lahore',
      zipCode: '54000',
      country: 'PK',
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.profile.state).toBeUndefined();
  });

  it('maps saved profile to invoice details', () => {
    const details = profileRecordToInvoiceDetails({
      name: 'Jane Doe',
      address: '123 Mall Road',
      city: 'Lahore',
      zipCode: '54000',
      country: 'PK',
      notes: 'VAT exempt',
    });
    expect(details).toMatchObject({
      name: 'Jane Doe',
      country: 'PK',
      notes: 'VAT exempt',
    });
  });

  it('detects complete billing profile input', () => {
    expect(
      isCompleteBillingProfileInput({
        name: 'Jane',
        address: '123 Mall Road',
        city: 'Lahore',
        zipCode: '54000',
        country: 'PK',
      }),
    ).toBe(true);
    expect(
      isCompleteBillingProfileInput({
        name: 'Jane',
        address: '123 Mall Road',
        city: 'Lahore',
        zipCode: '54000',
        country: 'US',
      }),
    ).toBe(false);
  });
});
