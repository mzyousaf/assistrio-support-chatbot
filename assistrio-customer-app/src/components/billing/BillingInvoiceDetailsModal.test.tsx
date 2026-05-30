import { BillingInvoiceDetailsModal } from '@/components/billing/BillingInvoiceDetailsModal';
import { BILLING_INVOICE_COUNTRIES } from '@/lib/billingInvoiceCountries';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const savedProfile = {
  workspaceId: 'ws-1',
  name: 'Acme Inc',
  address: '123 Mall Road',
  city: 'Lahore',
  zipCode: '54000',
  country: 'PK',
  email: 'billing@acme.com',
  updatedAt: '2026-05-01T00:00:00.000Z',
  updatedBy: 'user-1',
};

describe('BillingInvoiceDetailsModal', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses country dropdown and sends PK for Pakistan addresses', () => {
    const onSubmit = vi.fn();
    render(
      <BillingInvoiceDetailsModal
        open
        workspaceName="Acme Workspace"
        customerEmail="owner@example.com"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Company \/ Name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/^Address$/i), { target: { value: '123 Mall Road' } });
    fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Lahore' } });
    fireEvent.change(screen.getByLabelText(/ZIP \/ Postal code/i), { target: { value: '54000' } });
    fireEvent.change(screen.getByLabelText(/^Country$/i), { target: { value: 'PK' } });
    fireEvent.change(screen.getByLabelText(/State \/ Province/i), { target: { value: 'Punjab' } });

    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        city: 'Lahore',
        state: 'Punjab',
        zipCode: '54000',
        country: 'PK',
        saveProfile: true,
      }),
    );
    expect(onSubmit.mock.calls[0][0].country).not.toBe('US');
  });

  it('does not default country to US', () => {
    render(
      <BillingInvoiceDetailsModal
        open
        workspaceName="Acme Workspace"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const countrySelect = screen.getByLabelText(/^Country$/i) as HTMLSelectElement;
    expect(countrySelect.value).toBe('');
    expect(BILLING_INVOICE_COUNTRIES.some((row) => row.code === 'PK')).toBe(true);
  });

  it('prepopulates Company / Name with workspace name when no profile exists', () => {
    render(
      <BillingInvoiceDetailsModal
        open
        workspaceName="Acme Workspace"
        customerEmail="owner@example.com"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect((screen.getByLabelText(/Company \/ Name/i) as HTMLInputElement).value).toBe(
      'Acme Workspace',
    );
    expect((screen.getByLabelText(/Billing email/i) as HTMLInputElement).value).toBe(
      'owner@example.com',
    );
  });

  it('prepopulates saved billing profile when profile exists', () => {
    render(
      <BillingInvoiceDetailsModal
        open
        savedProfile={savedProfile}
        workspaceName="Acme Workspace"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect((screen.getByLabelText(/Company \/ Name/i) as HTMLInputElement).value).toBe('Acme Inc');
    expect((screen.getByLabelText(/^Address$/i) as HTMLInputElement).value).toBe('123 Mall Road');
    expect((screen.getByLabelText(/^Country$/i) as HTMLSelectElement).value).toBe('PK');
  });
});
