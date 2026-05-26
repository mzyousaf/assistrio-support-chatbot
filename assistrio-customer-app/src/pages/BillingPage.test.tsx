import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe, WorkspaceBillingSummary } from '@/api/types';
import { TRAINED_KNOWLEDGE_STORAGE_HELPER } from '@/lib/trainedKnowledgeStorageCopy';
import { SettingsBillingPage } from './PlansPage';

const mockGetWorkspaceBillingSummary = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getWorkspaceBillingSummary: (...args: unknown[]) => mockGetWorkspaceBillingSummary(...args),
}));

const baseWorkspace = {
  id: 'ws-1',
  name: 'Acme',
  planKey: 'free',
  planName: 'Free',
  subscriptionStatus: 'free',
  botLimit: 1,
  memberLimit: 3,
  monthlyAiCredits: 50,
  kbStorageMbPerBot: 5,
  analyticsHistoryDays: 7,
  canExportReports: false,
  showPoweredByAssistrio: true,
} as const;

const ownerCustomer: CustomerMe = {
  id: 'user-owner',
  email: 'owner@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-1',
  workspaceIds: ['ws-1'],
  workspaces: [{ ...baseWorkspace, role: 'owner' as const }],
};

const adminCustomer: CustomerMe = {
  ...ownerCustomer,
  id: 'user-admin',
  email: 'admin@example.com',
  workspaces: [{ ...baseWorkspace, role: 'admin' as const }],
};

function buildSummary(): WorkspaceBillingSummary {
  return {
    workspaceId: 'ws-1',
    plan: {
      key: 'free',
      name: 'Free',
      priceMonthly: 0,
      status: 'free',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    },
    entitlements: {
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 50,
      kbStorageMbPerBot: 5,
      maxKbStorageMbPerBot: 40,
      analyticsHistoryDays: 7,
      canExportReports: false,
      showPoweredByAssistrio: true,
      canRemoveBranding: false,
      activeAddons: [],
      topUpCreditsRemaining: 0,
    },
    usage: {
      bots: { current: 1, limit: 1 },
      members: { current: 2, pendingInvites: 1, used: 3, limit: 3 },
      aiCredits: {
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
        monthlyCredits: 50,
        monthlyCreditsUsed: 12,
        monthlyCreditsRemaining: 38,
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: 50,
        totalCreditsRemaining: 38,
        isOverLimit: false,
        byBot: [],
      },
      trainedKnowledge: {
        perBot: [],
        totalUsedBytes: 1024 * 1024,
        note: TRAINED_KNOWLEDGE_STORAGE_HELPER,
      },
    },
    planCatalog: [],
    addonCatalog: [],
  };
}

let mockCustomer: CustomerMe | null = ownerCustomer;

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    status: 'authenticated',
    customer: mockCustomer,
    refresh: vi.fn(),
    logout: vi.fn(),
    logoutInFlight: false,
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsBillingPage />
    </MemoryRouter>,
  );
}

describe('SettingsBillingPage', () => {
  beforeEach(() => {
    mockCustomer = ownerCustomer;
    mockGetWorkspaceBillingSummary.mockResolvedValue({ ok: true, data: buildSummary() });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders current billing summary with view plans link', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Free', level: 2 })).toBeTruthy();
    expect(screen.getByText('Credits included')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View plans' }).getAttribute('href')).toBe('/settings/plans');
  });

  it('shows payment setup notice', async () => {
    renderPage();
    expect(await screen.findByText('Payment setup')).toBeTruthy();
    expect(screen.getByText(/Checkout and payment methods are not enabled yet/i)).toBeTruthy();
  });

  it('shows usage snapshot', async () => {
    renderPage();
    expect(await screen.findByText('Usage snapshot')).toBeTruthy();
    expect(screen.getByText('12 used')).toBeTruthy();
    expect(screen.getByText('38 remaining')).toBeTruthy();
    expect(screen.getByText('1 / 1')).toBeTruthy();
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('shows future billing sections as coming soon', async () => {
    renderPage();
    expect(await screen.findByText('Billing management')).toBeTruthy();
    expect(screen.getByText('Payment method')).toBeTruthy();
    expect(screen.getByText('Invoices')).toBeTruthy();
    const comingSoonButtons = screen.getAllByRole('button', { name: 'Coming soon' });
    expect(comingSoonButtons.length).toBeGreaterThanOrEqual(3);
  });

  it('shows owner billing note', async () => {
    renderPage();
    expect(await screen.findByText('Checkout is not enabled yet.')).toBeTruthy();
  });

  it('shows non-owner billing note for admin', async () => {
    mockCustomer = adminCustomer;
    cleanup();
    renderPage();
    expect(
      await screen.findByText(
        'Only workspace owners will be able to manage billing when payments are enabled.',
      ),
    ).toBeTruthy();
  });

  it('handles no active workspace', async () => {
    mockCustomer = { ...ownerCustomer, activeWorkspaceId: null, workspaces: [] };
    renderPage();
    expect(await screen.findByText('No active workspace selected.')).toBeTruthy();
    expect(mockGetWorkspaceBillingSummary).not.toHaveBeenCalled();
  });

  it('handles API error with retry', async () => {
    mockGetWorkspaceBillingSummary
      .mockResolvedValueOnce({ ok: false, error: 'Network error' })
      .mockResolvedValueOnce({ ok: true, data: buildSummary() });

    renderPage();
    expect(await screen.findByText('Could not load billing details')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Usage snapshot')).toBeTruthy();
  });

  it('shows loading skeleton while fetching', async () => {
    mockGetWorkspaceBillingSummary.mockImplementation(
      () => new Promise(() => {
        /* never resolves */
      }),
    );
    renderPage();
    expect(await screen.findByLabelText('Loading billing')).toBeTruthy();
  });
});
