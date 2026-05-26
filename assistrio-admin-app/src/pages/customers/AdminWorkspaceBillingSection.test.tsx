import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminWorkspaceBillingSection } from './AdminWorkspaceBillingSection';
import { CustomerWorkspacesPage } from './CustomerWorkspacesPage';

const mockGetBillingSummary = vi.fn();
const mockGetWorkspaces = vi.fn();

vi.mock('@/api/adminApi', () => ({
  getAdminWorkspaceBillingSummary: (...args: unknown[]) => mockGetBillingSummary(...args),
  getAdminCustomerWorkspaces: (...args: unknown[]) => mockGetWorkspaces(...args),
}));

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
