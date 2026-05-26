import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe, WorkspaceBillingSummary } from '@/api/types';
import {
  TRAINED_KNOWLEDGE_STORAGE_HELPER,
  TRAINED_KNOWLEDGE_STORAGE_LABEL,
} from '@/lib/trainedKnowledgeStorageCopy';
import { PlansPage } from './PlansPage';

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

const memberCustomer: CustomerMe = {
  ...ownerCustomer,
  id: 'user-member',
  email: 'member@example.com',
  workspaces: [{ ...baseWorkspace, role: 'member' as const }],
};

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

function buildSummary(overrides?: Partial<WorkspaceBillingSummary>): WorkspaceBillingSummary {
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
        monthlyCreditsUsed: 0,
        monthlyCreditsRemaining: 50,
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: 50,
        totalCreditsRemaining: 50,
        isOverLimit: false,
        byBot: [],
      },
      trainedKnowledge: {
        perBot: [],
        totalUsedBytes: 0,
        note: TRAINED_KNOWLEDGE_STORAGE_HELPER,
      },
    },
    planCatalog: [
      {
        key: 'free',
        name: 'Free',
        priceMonthly: 0,
        botLimit: 1,
        memberLimit: 3,
        monthlyAiCredits: 50,
        kbStorageMbPerBot: 5,
        analyticsHistoryDays: 7,
        canExportReports: false,
      },
      {
        key: 'starter',
        name: 'Starter',
        priceMonthly: 49,
        botLimit: 1,
        memberLimit: 3,
        monthlyAiCredits: 500,
        kbStorageMbPerBot: 15,
        analyticsHistoryDays: null,
        canExportReports: true,
      },
      {
        key: 'pro',
        name: 'Pro',
        priceMonthly: 99,
        botLimit: 1,
        memberLimit: 5,
        monthlyAiCredits: 3000,
        kbStorageMbPerBot: 30,
        analyticsHistoryDays: null,
        canExportReports: true,
      },
    ],
    addonCatalog: [
      {
        key: 'ai_credits_1000',
        name: '1,000 extra AI credits',
        billingInterval: 'one_time',
        priceUsd: 30,
        scope: 'workspace',
        checkoutAvailable: false,
      },
      {
        key: 'extra_bot',
        name: 'Extra bot',
        billingInterval: 'monthly',
        priceUsd: 49,
        scope: 'workspace',
        checkoutAvailable: false,
      },
      {
        key: 'remove_branding',
        name: 'Remove Powered by Assistrio',
        billingInterval: 'monthly',
        priceUsd: 20,
        scope: 'workspace',
        checkoutAvailable: false,
      },
      {
        key: 'kb_storage_5mb',
        name: '+5 MB KB storage',
        billingInterval: 'monthly',
        priceUsd: 10,
        scope: 'bot',
        checkoutAvailable: false,
      },
      {
        key: 'kb_storage_10mb',
        name: '+10 MB KB storage',
        billingInterval: 'monthly',
        priceUsd: 15,
        scope: 'bot',
        checkoutAvailable: false,
      },
    ],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PlansPage />
    </MemoryRouter>,
  );
}

describe('PlansPage', () => {
  beforeEach(() => {
    mockCustomer = ownerCustomer;
    mockGetWorkspaceBillingSummary.mockResolvedValue({ ok: true, data: buildSummary() });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads billing summary for the active workspace', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetWorkspaceBillingSummary).toHaveBeenCalledWith('ws-1');
    });
    expect(await screen.findByText('Compare workspace plans, limits, and add-ons.')).toBeTruthy();
    expect(screen.getByText('Checkout is not enabled yet.')).toBeTruthy();
  });

  it('renders current plan hero with entitlements', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Free', level: 2 })).toBeTruthy();
    expect(screen.getAllByText('Current plan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(TRAINED_KNOWLEDGE_STORAGE_LABEL)).toBeTruthy();
    expect(screen.getAllByText(TRAINED_KNOWLEDGE_STORAGE_HELPER).length).toBeGreaterThan(0);
    expect(screen.getByText('50 / month')).toBeTruthy();
  });

  it('renders Free, Starter, and Pro from planCatalog', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Starter' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeTruthy();
    expect(screen.getAllByText('$49/month').length).toBeGreaterThan(0);
    expect(screen.getByText('$99/month')).toBeTruthy();
  });

  it('shows current plan badge and disabled current plan button', async () => {
    renderPage();
    expect(await screen.findByText('Current plan', { selector: 'span' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Current plan' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows disabled Coming soon for other plans', async () => {
    renderPage();
    const comingSoonButtons = await screen.findAllByRole('button', { name: 'Coming soon' });
    expect(comingSoonButtons.length).toBeGreaterThanOrEqual(2);
    expect(comingSoonButtons.every((button) => button.hasAttribute('disabled'))).toBe(true);
    expect(screen.getByText('Plan changes are not available yet.')).toBeTruthy();
  });

  it('renders add-on cards from addonCatalog', async () => {
    renderPage();
    expect(await screen.findByText('1,000 extra AI credits')).toBeTruthy();
    expect(screen.getByText('Extra bot')).toBeTruthy();
    expect(screen.getByText('Remove Powered by Assistrio')).toBeTruthy();
    expect(screen.getByText('+5 MB trained KB storage')).toBeTruthy();
    expect(screen.getByText('+10 MB trained KB storage')).toBeTruthy();
    expect(screen.getByText('Add-ons are not available yet.')).toBeTruthy();
  });

  it('shows owner billing note in header', async () => {
    renderPage();
    expect(await screen.findByText('Checkout is not enabled yet.')).toBeTruthy();
  });

  it('shows non-owner billing note in header', async () => {
    mockCustomer = memberCustomer;
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
    expect(screen.getByText('Network error')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Compare plans')).toBeTruthy();
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

  it('refetches when active workspace changes', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetWorkspaceBillingSummary).toHaveBeenCalledWith('ws-1');
    });

    mockCustomer = {
      ...ownerCustomer,
      activeWorkspaceId: 'ws-2',
      workspaceIds: ['ws-1', 'ws-2'],
      workspaces: [
        { ...baseWorkspace, id: 'ws-1', role: 'owner' },
        { ...baseWorkspace, id: 'ws-2', name: 'Beta', role: 'owner' },
      ],
    };

    cleanup();
    renderPage();

    await waitFor(() => {
      expect(mockGetWorkspaceBillingSummary).toHaveBeenCalledWith('ws-2');
    });
  });
});
