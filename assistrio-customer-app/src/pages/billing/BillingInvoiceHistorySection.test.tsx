import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceBillingInvoiceRow, WorkspaceBillingProfile } from '@/api/types';
import { clearWorkspaceBillingProfileCache } from '@/lib/workspaceBillingProfileStore';
import { BillingInvoiceHistorySection } from './BillingInvoiceHistorySection';

const mockGetWorkspaceBillingInvoices = vi.fn();
const mockGetWorkspaceBillingProfile = vi.fn();
const mockFetchWorkspaceBillingInvoicePdf = vi.fn();
const mockFetchWorkspaceBillingHistoryCsv = vi.fn();
const mockTriggerBlobDownload = vi.fn();
const mockAppToastError = vi.fn();
const mockApplyProfile = vi.fn();
const mockReloadProfile = vi.fn();
let mockBillingProfile: WorkspaceBillingProfile | null = null;

vi.mock('@/api/customerApi', () => ({
  getWorkspaceBillingInvoices: (...args: unknown[]) => mockGetWorkspaceBillingInvoices(...args),
  getWorkspaceBillingProfile: (...args: unknown[]) => mockGetWorkspaceBillingProfile(...args),
  fetchWorkspaceBillingInvoicePdf: (...args: unknown[]) =>
    mockFetchWorkspaceBillingInvoicePdf(...args),
  fetchWorkspaceBillingHistoryCsv: (...args: unknown[]) =>
    mockFetchWorkspaceBillingHistoryCsv(...args),
}));

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: {
      id: 'user-1',
      email: 'owner@example.com',
      activeWorkspaceId: 'ws-1',
      workspaceIds: ['ws-1'],
      workspaces: [{ id: 'ws-1', name: 'Acme Workspace', role: 'owner' }],
    },
  }),
}));

vi.mock('@/hooks/useWorkspaceBillingProfile', () => ({
  useWorkspaceBillingProfile: () => ({
    profile: mockBillingProfile,
    loading: false,
    error: null,
    saving: false,
    reload: mockReloadProfile,
    saveProfile: vi.fn(),
    applyProfile: mockApplyProfile,
    hasProfile: Boolean(mockBillingProfile),
    hasCompleteProfile: Boolean(mockBillingProfile),
  }),
}));

vi.mock('@/lib/billingInvoicePdfDownload', () => ({
  triggerBlobDownload: (...args: unknown[]) => mockTriggerBlobDownload(...args),
}));

vi.mock('@/lib/app-toast', () => ({
  appToast: {
    error: (...args: unknown[]) => mockAppToastError(...args),
  },
}));

function buildInvoice(overrides?: Partial<WorkspaceBillingInvoiceRow>): WorkspaceBillingInvoiceRow {
  return {
    id: 'inv-1',
    provider: 'lemon_squeezy',
    date: '2026-05-01T00:00:00.000Z',
    amount: 49,
    amountCents: 4900,
    amountFormatted: '$49.00',
    currency: 'USD',
    status: 'paid',
    invoiceUrl: 'https://invoice.example/1',
    receiptUrl: null,
    description: 'Starter subscription started',
    itemType: 'plan',
    itemKey: 'starter',
    itemName: 'Starter',
    source: 'lemon_subscription_invoice',
    billingKind: 'subscription_invoice',
    requiresBillingDetails: false,
    ...overrides,
  };
}

describe('BillingInvoiceHistorySection', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockBillingProfile = null;
    clearWorkspaceBillingProfileCache();
    mockFetchWorkspaceBillingInvoicePdf.mockReset();
    mockFetchWorkspaceBillingHistoryCsv.mockReset();
    mockGetWorkspaceBillingInvoices.mockReset();
    vi.unstubAllGlobals();
  });

  it('downloads billing history CSV from backend', async () => {
    const csvBlob = new Blob(['Date,Item'], { type: 'text/csv' });
    mockGetWorkspaceBillingInvoices.mockResolvedValue({ ok: true, data: [buildInvoice()] });
    mockFetchWorkspaceBillingHistoryCsv.mockResolvedValue({
      ok: true,
      data: { blob: csvBlob, filename: 'assistrio-billing-history.csv' },
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    fireEvent.click(await screen.findByRole('button', { name: /Export/i }));

    await waitFor(() => {
      expect(mockFetchWorkspaceBillingHistoryCsv).toHaveBeenCalledWith('ws-1');
      expect(mockTriggerBlobDownload).toHaveBeenCalledWith(
        csvBlob,
        'assistrio-billing-history.csv',
      );
    });
  });

  it('paginates billing history client-side with ten rows per page by default', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: Array.from({ length: 11 }, (_, index) =>
        buildInvoice({
          id: `inv-${index + 1}`,
          itemName: `Invoice ${index + 1}`,
        }),
      ),
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    expect(await screen.findByText('Invoice 1')).toBeTruthy();
    expect(screen.getByText('Invoice 10')).toBeTruthy();
    expect(screen.queryByText('Invoice 11')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Billing history pagination' })).toBeTruthy();
    expect(screen.getByText('Showing 1–10 of 11')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Invoice 11')).toBeTruthy();
    expect(screen.queryByText('Invoice 1')).toBeNull();
    expect(screen.getByText('Showing 11–11 of 11')).toBeTruthy();
    expect(screen.getByText('Page 2 / 2')).toBeTruthy();
  });

  it('shows per page selector even when all invoices fit on one page', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        buildInvoice({ id: 'inv-1', itemName: 'Invoice One' }),
        buildInvoice({ id: 'inv-2', itemName: 'Invoice Two' }),
      ],
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    expect(await screen.findByLabelText('Items per page')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Billing history pagination' })).toBeTruthy();
    expect(screen.getByText('Showing 1–2 of 2')).toBeTruthy();
  });

  it('changes visible rows when per page size changes', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: Array.from({ length: 11 }, (_, index) =>
        buildInvoice({
          id: `inv-${index + 1}`,
          itemName: `Invoice ${index + 1}`,
        }),
      ),
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    expect(await screen.findByText('Invoice 10')).toBeTruthy();
    expect(screen.queryByText('Invoice 11')).toBeNull();

    fireEvent.click(screen.getByLabelText('Items per page'));
    fireEvent.click(screen.getByRole('option', { name: '3' }));

    expect(await screen.findByText('Invoice 3')).toBeTruthy();
    expect(screen.queryByText('Invoice 11')).toBeNull();
    expect(screen.getByText('Showing 1–3 of 11')).toBeTruthy();
  });

  it('exports full billing history from backend while paginated on page two', async () => {
    const csvBlob = new Blob(['Date,Item'], { type: 'text/csv' });
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: Array.from({ length: 11 }, (_, index) =>
        buildInvoice({
          id: `inv-${index + 1}`,
          itemName: `Invoice ${index + 1}`,
        }),
      ),
    });
    mockFetchWorkspaceBillingHistoryCsv.mockResolvedValue({
      ok: true,
      data: { blob: csvBlob, filename: 'assistrio-billing-history.csv' },
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Invoice 11')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Export/i }));

    await waitFor(() => {
      expect(mockFetchWorkspaceBillingHistoryCsv).toHaveBeenCalledWith('ws-1');
      expect(mockFetchWorkspaceBillingHistoryCsv).toHaveBeenCalledTimes(1);
      expect(mockTriggerBlobDownload).toHaveBeenCalledWith(
        csvBlob,
        'assistrio-billing-history.csv',
      );
    });
  });

  it('shows billing cadence for monthly, annual, and one-time rows', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        buildInvoice({
          id: 'inv-monthly',
          itemName: 'Starter',
          billingInterval: 'monthly',
        }),
        buildInvoice({
          id: 'inv-annual',
          itemName: 'Pro',
          itemKey: 'pro',
          billingInterval: 'yearly',
        }),
        buildInvoice({
          id: 'order-top-up',
          itemType: 'top_up',
          itemName: '1,000 AI credits',
          billingInterval: undefined,
        }),
      ],
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    expect(await screen.findByText('Monthly')).toBeTruthy();
    expect(screen.getByText('Annually')).toBeTruthy();
    expect(screen.getByText('One-time')).toBeTruthy();
  });

  it('shows View Invoice for subscription invoice without invoice URL', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        buildInvoice({
          invoiceUrl: null,
          billingKind: 'subscription_invoice',
        }),
      ],
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    expect(await screen.findByRole('button', { name: /View Invoice/i })).toBeTruthy();
    expect(screen.queryByText('Receipt/PDF unavailable')).toBeNull();
  });

  it('shows View Invoice for top-up order rows', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        buildInvoice({
          id: 'order-top-up',
          itemType: 'top_up',
          itemName: '1,000 AI credits',
          description: '1,000 AI credits top-up',
          invoiceUrl: null,
          receiptUrl: 'https://receipt.example/top-up',
          officialInvoiceUrl: 'https://receipt.example/top-up',
          billingKind: 'order',
          requiresBillingDetails: false,
        }),
      ],
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    expect(await screen.findByRole('button', { name: /View Invoice/i })).toBeTruthy();
    expect(screen.queryByText('Receipt/PDF unavailable')).toBeNull();
  });

  it('does not render for members without billing document access', () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({ ok: true, data: [] });
    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView={false} />);
    expect(screen.queryByRole('button', { name: /Export/i })).toBeNull();
  });

  it('downloads subscription invoice PDF via backend proxy', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const pdfBlob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [buildInvoice()],
    });
    mockFetchWorkspaceBillingInvoicePdf.mockResolvedValue({
      ok: true,
      data: { kind: 'pdf', blob: pdfBlob, filename: 'assistrio-billing-inv-1.pdf' },
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    fireEvent.click(await screen.findByRole('button', { name: /View Invoice/i }));

    await waitFor(() => {
      expect(mockFetchWorkspaceBillingInvoicePdf).toHaveBeenCalledWith('ws-1', 'inv-1', undefined);
      expect(mockTriggerBlobDownload).toHaveBeenCalledWith(pdfBlob, 'assistrio-billing-inv-1.pdf');
    });
    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('View invoice')).toBeNull();
    expect(screen.queryByText('View receipt')).toBeNull();
    expect(screen.queryByText('Unavailable')).toBeNull();
  });

  it('downloads top-up PDF on first click without opening Lemon', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const pdfBlob = new Blob(['%PDF-1.4 generated'], { type: 'application/pdf' });
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        buildInvoice({
          id: 'order-top-up',
          itemType: 'top_up',
          itemName: '1,000 AI credits',
          description: '1,000 AI credits top-up',
          amountFormatted: '$30.00',
          amountCents: 3000,
          billingKind: 'order',
          requiresBillingDetails: false,
        }),
      ],
    });
    mockFetchWorkspaceBillingInvoicePdf.mockResolvedValue({
      ok: true,
      data: { kind: 'pdf', blob: pdfBlob, filename: 'assistrio-billing-order-top-up.pdf' },
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);
    fireEvent.click(await screen.findByRole('button', { name: /View Invoice/i }));

    await waitFor(() => {
      expect(mockFetchWorkspaceBillingInvoicePdf).toHaveBeenCalledWith(
        'ws-1',
        'order-top-up',
        undefined,
      );
      expect(mockTriggerBlobDownload).toHaveBeenCalledWith(
        pdfBlob,
        'assistrio-billing-order-top-up.pdf',
      );
    });
    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Billing details' })).toBeNull();
  });

  it('opens hosted provider invoice in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        buildInvoice({
          invoiceUrl: 'https://invoice.example/html-page',
          officialInvoiceUrl: 'https://invoice.example/html-page',
          invoiceDeliveryMode: 'provider_url',
        }),
      ],
    });
    mockFetchWorkspaceBillingInvoicePdf.mockResolvedValue({
      ok: true,
      data: {
        kind: 'provider_url',
        url: 'https://invoice.example/html-page',
        source: 'lemon_subscription_invoice',
      },
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);
    fireEvent.click(await screen.findByRole('button', { name: /View Invoice/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        'https://invoice.example/html-page',
        '_blank',
        'noopener,noreferrer',
      );
    });
    expect(mockTriggerBlobDownload).not.toHaveBeenCalled();
  });

  it('shows View Invoice label for provider hosted rows', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [buildInvoice({ invoiceDeliveryMode: 'provider_url' })],
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);
    expect(await screen.findByRole('button', { name: /View Invoice/i })).toBeTruthy();
  });

  it('downloads local subscription PDF without unavailable toast', async () => {
    const pdfBlob = new Blob(['%PDF-1.4 local'], { type: 'application/pdf' });
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        buildInvoice({
          invoiceUrl: 'https://invoice.example/html-page',
          officialInvoiceUrl: 'https://invoice.example/html-page',
        }),
      ],
    });
    mockFetchWorkspaceBillingInvoicePdf.mockResolvedValue({
      ok: true,
      data: { kind: 'pdf', blob: pdfBlob, filename: 'assistrio-billing-inv-1.pdf' },
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);
    fireEvent.click(await screen.findByRole('button', { name: /View Invoice/i }));

    await waitFor(() => {
      expect(mockTriggerBlobDownload).toHaveBeenCalledWith(pdfBlob, 'assistrio-billing-inv-1.pdf');
    });
    expect(mockAppToastError).not.toHaveBeenCalled();
  });

  it('opens invoice details modal when billing details are required', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        buildInvoice({
          id: 'order-top-up',
          billingKind: 'order',
          invoiceUrl: null,
          requiresBillingDetails: true,
          invoiceDeliveryMode: 'local_pdf',
        }),
      ],
    });
    mockFetchWorkspaceBillingInvoicePdf.mockResolvedValue({
      ok: false,
      error: 'Billing details are required to generate this invoice.',
      errorCode: 'billing_invoice_details_required',
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);
    fireEvent.click(await screen.findByRole('button', { name: /View Invoice/i }));

    expect(
      await screen.findByRole('heading', { name: 'Billing details' }),
    ).toBeTruthy();
  });

  it('submits invoice modal with save-for-future flag', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        buildInvoice({
          id: 'order-top-up',
          billingKind: 'order',
          invoiceUrl: null,
          requiresBillingDetails: true,
        }),
      ],
    });
    mockFetchWorkspaceBillingInvoicePdf
      .mockResolvedValueOnce({
        ok: false,
        errorCode: 'billing_invoice_details_required',
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { kind: 'pdf', blob: new Blob(['%PDF']), filename: 'assistrio-billing-order-top-up.pdf' },
      });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);
    fireEvent.click(await screen.findByRole('button', { name: /View Invoice/i }));

    fireEvent.change(await screen.findByLabelText(/Company \/ Name/i), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByLabelText(/^Address$/i), { target: { value: '123 Mall Road' } });
    fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Lahore' } });
    fireEvent.change(screen.getByLabelText(/ZIP \/ Postal code/i), { target: { value: '54000' } });
    fireEvent.change(screen.getByLabelText(/^Country$/i), { target: { value: 'PK' } });
    fireEvent.click(
      screen.getByRole('dialog').querySelector('button[type="submit"]') as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(mockFetchWorkspaceBillingInvoicePdf).toHaveBeenLastCalledWith(
        'ws-1',
        'order-top-up',
        expect.objectContaining({ country: 'PK', saveProfile: true }),
      );
    });
    expect(mockApplyProfile).toHaveBeenCalled();
    expect(mockReloadProfile).toHaveBeenCalled();
  });

  it('next download skips modal when saved profile is complete', async () => {
    mockBillingProfile = {
      workspaceId: 'ws-1',
      name: 'Acme Inc',
      address: '123 Mall Road',
      city: 'Lahore',
      zipCode: '54000',
      country: 'PK',
      updatedAt: '2026-05-01T00:00:00.000Z',
      updatedBy: 'user-1',
    };
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        buildInvoice({
          id: 'order-top-up',
          billingKind: 'order',
          invoiceUrl: null,
          requiresBillingDetails: false,
        }),
      ],
    });
    mockFetchWorkspaceBillingInvoicePdf.mockResolvedValue({
      ok: true,
      data: { kind: 'pdf', blob: new Blob(['%PDF']), filename: 'assistrio-billing-order-top-up.pdf' },
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);
    fireEvent.click(await screen.findByRole('button', { name: /View Invoice/i }));

    await waitFor(() => {
      expect(mockFetchWorkspaceBillingInvoicePdf).toHaveBeenCalledWith(
        'ws-1',
        'order-top-up',
        undefined,
      );
    });
    expect(screen.queryByRole('heading', { name: 'Billing details' })).toBeNull();
  });

  it('shows error toast when PDF fetch fails', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [buildInvoice()],
    });
    mockFetchWorkspaceBillingInvoicePdf.mockResolvedValue({
      ok: false,
      error: 'Invoice PDF is not available right now.',
      errorCode: 'billing_invoice_pdf_unavailable',
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    fireEvent.click(await screen.findByRole('button', { name: /View Invoice/i }));

    await waitFor(() => {
      expect(mockAppToastError).toHaveBeenCalledWith('Invoice PDF is not available right now.');
    });
    expect(mockTriggerBlobDownload).not.toHaveBeenCalled();
  });

  it('shows empty state when no invoices exist', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({ ok: true, data: [] });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    expect(await screen.findByText('No invoices yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /View Invoice/i })).toBeNull();
  });

  it('shows Starter plan and extra bot add-on invoice rows with correct labels', async () => {
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        buildInvoice({
          id: 'lemon_subscription_invoice:inv-plan-1:sub-plan',
          itemType: 'plan',
          itemName: 'Starter',
          description: 'Starter subscription started',
          amountFormatted: '$49.00',
          invoiceUrl: 'https://invoice.example/starter',
        }),
        buildInvoice({
          id: 'lemon_subscription_invoice:inv-addon-bot:sub-addon-bot',
          itemType: 'addon',
          itemName: 'Extra bot',
          description: 'Extra bot add-on',
          amountFormatted: '$49.00',
          amount: 49,
          amountCents: 4900,
          invoiceUrl: 'https://invoice.example/extra-bot',
        }),
      ],
    });

    render(<BillingInvoiceHistorySection workspaceId="ws-1" canView />);

    expect(await screen.findByText('Starter')).toBeTruthy();
    expect(screen.getByText('Extra AI Agent')).toBeTruthy();
    expect(screen.getAllByText('$49.00').length).toBeGreaterThanOrEqual(2);
  });
});
