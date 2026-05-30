import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminWorkspaceBillingSection } from './AdminWorkspaceBillingSection';
import { CustomerWorkspacesPage } from './CustomerWorkspacesPage';

const mockGetBillingSummary = vi.fn();
const mockPostBillingSync = vi.fn();
const mockPostReplayWebhook = vi.fn();
const mockGetWorkspaces = vi.fn();

vi.mock('@/api/adminApi', () => ({
  getAdminWorkspaceBillingSummary: (...args: unknown[]) => mockGetBillingSummary(...args),
  postAdminWorkspaceBillingSync: (...args: unknown[]) => mockPostBillingSync(...args),
  postAdminReplayWebhookEvent: (...args: unknown[]) => mockPostReplayWebhook(...args),
  getAdminCustomerWorkspaces: (...args: unknown[]) => mockGetWorkspaces(...args),
}));

const billingSupport = {
  provider: {
    provider: 'lemon_squeezy',
    providerCustomerId: 'cust-99',
    providerSubscriptionId: 'sub-99',
    providerVariantId: 'var-99',
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: false,
    currentPeriodStart: '2026-05-01T00:00:00.000Z',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
  },
  addons: [
    {
      addonKey: 'extra_bot',
      targetBotId: 'bot-1',
      status: 'active',
      providerSubscriptionId: 'addon-sub-1',
      providerOrderId: null,
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    },
  ],
  topUps: [
    {
      creditsPurchased: 1000,
      creditsRemaining: 750,
      expiresAt: '2026-12-01T00:00:00.000Z',
      providerOrderId: 'order-42',
      createdAt: '2026-05-15T00:00:00.000Z',
    },
  ],
  webhookEvents: [
    {
      id: 'evt-1',
      eventName: 'subscription_updated',
      status: 'processed',
      createdAt: '2026-05-20T12:00:00.000Z',
      processedAt: '2026-05-20T12:00:01.000Z',
      processingError: null,
    },
    {
      id: 'evt-2',
      eventName: 'order_created',
      status: 'failed',
      createdAt: '2026-05-19T12:00:00.000Z',
      processedAt: null,
      processingError: 'Invalid variant',
    },
    {
      id: 'evt-3',
      eventName: 'subscription_payment_success',
      status: 'received',
      createdAt: '2026-05-18T12:00:00.000Z',
      processedAt: null,
      processingError: null,
    },
  ],
};

const billingSummary = {
  workspaceId: 'ws-1',
  plan: {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 49,
    status: 'active',
    currentPeriodStart: '2026-05-01T00:00:00.000Z',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
  },
  entitlements: {
    botLimit: 1,
    memberLimit: 3,
    monthlyAiCredits: 500,
    kbStorageMbPerBot: 15,
    maxKbStorageMbPerBot: 40,
    analyticsHistoryDays: null,
    canExportReports: true,
    showPoweredByAssistrio: true,
    canRemoveBranding: false,
    activeAddons: [],
    topUpCreditsRemaining: 0,
  },
  usage: {
    bots: { current: 1, limit: 1 },
    members: { current: 2, pendingInvites: 0, used: 2, limit: 3 },
    aiCredits: {
      periodStart: '2026-05-01T00:00:00.000Z',
      periodEnd: '2026-06-01T00:00:00.000Z',
      monthlyCredits: 500,
      monthlyCreditsUsed: 120,
      monthlyCreditsRemaining: 380,
      topUpCreditsRemaining: 0,
      totalCreditsAvailable: 500,
      totalCreditsRemaining: 380,
      isOverLimit: false,
      byBot: [],
    },
    trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: 'Per-agent trained knowledge usage.' },
  },
  planCatalog: [],
  addonCatalog: [],
  admin: {
    workspaceName: 'Acme',
    workspaceOwnerEmail: 'owner@example.com',
    subscriptionId: 'sub-1',
    subscriptionCreatedAt: '2026-01-01T00:00:00.000Z',
    subscriptionUpdatedAt: '2026-05-01T00:00:00.000Z',
    activeAddons: [],
    topUpCreditsRemaining: 0,
    usageLedgerCount: 10,
  },
  support: billingSupport,
};

function CustomerDetailTestShell() {
  return (
    <Outlet
      context={{
        customer: { id: 'cust-1', name: 'Jane Doe', email: 'jane@example.com' },
        reload: async () => {},
      }}
    />
  );
}

describe('AdminWorkspaceBillingSection', () => {
  afterEach(() => {
    cleanup();
    mockGetBillingSummary.mockReset();
    mockPostBillingSync.mockReset();
    mockPostReplayWebhook.mockReset();
  });

  it('renders plan and usage after loading', async () => {
    mockGetBillingSummary.mockResolvedValue({ ok: true, data: billingSummary });

    render(<AdminWorkspaceBillingSection workspaceId="ws-1" />);

    expect(screen.getByLabelText('Loading billing details')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('Billing & usage')).toBeTruthy();
    });
    expect(screen.getByText(/Starter · Active · read-only/)).toBeTruthy();
    expect(screen.getByText('120 / 500 used')).toBeTruthy();
  });

  it('renders provider details, add-ons, top-ups, and webhook events', async () => {
    mockGetBillingSummary.mockResolvedValue({ ok: true, data: billingSummary });

    render(<AdminWorkspaceBillingSection workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByText('Provider details')).toBeTruthy();
    });
    expect(screen.getByText('lemon_squeezy')).toBeTruthy();
    expect(screen.getByText('cust-99')).toBeTruthy();
    expect(screen.getByText('sub-99')).toBeTruthy();
    expect(screen.getByText('extra_bot')).toBeTruthy();
    expect(screen.getByText('addon-sub-1')).toBeTruthy();
    expect(screen.getByText('order-42')).toBeTruthy();
    expect(screen.getByText('subscription_updated')).toBeTruthy();
    expect(screen.getByText('Invalid variant')).toBeTruthy();
  });

  it('shows replay button for failed and received webhook events only', async () => {
    mockGetBillingSummary.mockResolvedValue({ ok: true, data: billingSummary });

    render(<AdminWorkspaceBillingSection workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Replay' })).toHaveLength(2);
    });
  });

  it('sync billing calls API and refetches summary', async () => {
    mockGetBillingSummary.mockResolvedValue({ ok: true, data: billingSummary });
    mockPostBillingSync.mockResolvedValue({
      ok: true,
      data: { synced: true, message: 'Subscription synced from Lemon Squeezy.' },
    });

    render(<AdminWorkspaceBillingSection workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sync billing' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sync billing' }));

    await waitFor(() => {
      expect(mockPostBillingSync).toHaveBeenCalledWith('ws-1');
    });
    expect(mockGetBillingSummary.mock.calls.length).toBeGreaterThanOrEqual(2);
    await waitFor(() => {
      expect(screen.getByText('Subscription synced from Lemon Squeezy.')).toBeTruthy();
    });
  });

  it('replay webhook calls API, refetches summary, and shows success message', async () => {
    mockGetBillingSummary.mockResolvedValue({ ok: true, data: billingSummary });
    mockPostReplayWebhook.mockResolvedValue({
      ok: true,
      data: { replayed: true, status: 'processed', message: 'Webhook event replayed successfully.' },
    });

    render(<AdminWorkspaceBillingSection workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Replay' })).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Replay' })[0]);

    await waitFor(() => {
      expect(mockPostReplayWebhook).toHaveBeenCalledWith('evt-2');
    });
    expect(mockGetBillingSummary.mock.calls.length).toBeGreaterThanOrEqual(2);
    await waitFor(() => {
      expect(screen.getByText('Webhook event replayed successfully.')).toBeTruthy();
    });
  });

  it('shows replay error when API fails', async () => {
    mockGetBillingSummary.mockResolvedValue({ ok: true, data: billingSummary });
    mockPostReplayWebhook.mockResolvedValue({ ok: false, error: 'Replay forbidden' });

    render(<AdminWorkspaceBillingSection workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Replay' })).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Replay' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Replay forbidden')).toBeTruthy();
    });
  });

  it('shows sync error when API fails', async () => {
    mockGetBillingSummary.mockResolvedValue({ ok: true, data: billingSummary });
    mockPostBillingSync.mockResolvedValue({ ok: false, error: 'Forbidden' });

    render(<AdminWorkspaceBillingSection workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sync billing' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sync billing' }));

    await waitFor(() => {
      expect(screen.getByText('Forbidden')).toBeTruthy();
    });
  });

  it('shows error card with retry', async () => {
    mockGetBillingSummary.mockResolvedValueOnce({ ok: false, error: 'Network error' });

    render(<AdminWorkspaceBillingSection workspaceId="ws-1" />);

    await waitFor(() => {
      expect(screen.getByText('Could not load billing details')).toBeTruthy();
    });

    mockGetBillingSummary.mockResolvedValueOnce({ ok: true, data: billingSummary });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Billing & usage')).toBeTruthy();
    });
  });
});

describe('CustomerWorkspacesPage', () => {
  afterEach(() => {
    cleanup();
    mockGetWorkspaces.mockReset();
  });

  it('shows plan badge in workspace table', async () => {
    mockGetWorkspaces.mockResolvedValue({
      ok: true,
      data: {
        workspaces: [
          {
            id: 'ws-1',
            name: 'Acme',
            role: 'owner',
            memberCount: 2,
            botCount: 1,
            planKey: 'starter',
            planName: 'Starter',
            subscriptionStatus: 'active',
            monthlyAiCredits: 500,
            aiCreditsUsedThisPeriod: 120,
            botLimit: 1,
            memberLimit: 3,
            currentBots: 1,
            currentMembers: 2,
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={['/customers/cust-1/workspaces']}>
        <Routes>
          <Route path="/customers/:customerId" element={<CustomerDetailTestShell />}>
            <Route path="workspaces" element={<CustomerWorkspacesPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeTruthy();
    });
    expect(screen.getByText('120 / 500')).toBeTruthy();
  });
});
