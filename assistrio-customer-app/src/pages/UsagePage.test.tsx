import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe, WorkspaceBillingSummary } from '@/api/types';
import {
  TRAINED_KNOWLEDGE_STORAGE_HELPER,
  TRAINED_KNOWLEDGE_STORAGE_LABEL,
} from '@/lib/trainedKnowledgeStorageCopy';
import { UsagePage } from './UsagePage';

const mockGetWorkspaceBillingSummary = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getWorkspaceBillingSummary: (...args: unknown[]) => mockGetWorkspaceBillingSummary(...args),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="recharts-responsive">{children}</div>
  ),
  AreaChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="usage-credits-chart">{children}</div>
  ),
  Area: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  defs: ({ children }: { children: ReactNode }) => <svg>{children}</svg>,
  linearGradient: ({ children }: { children: ReactNode }) => <g>{children}</g>,
  stop: () => null,
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

const baseCustomer: CustomerMe = {
  id: 'user-1',
  email: 'member@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-1',
  workspaceIds: ['ws-1'],
  workspaces: [{ ...baseWorkspace, role: 'member' as const }],
};

let mockCustomer: CustomerMe | null = baseCustomer;

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
        monthlyCreditsUsed: 10,
        monthlyCreditsRemaining: 40,
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: 50,
        totalCreditsRemaining: 40,
        isOverLimit: false,
        byBot: [{ botId: 'bot-1', creditsUsed: 10 }],
      },
      trainedKnowledge: {
        perBot: [
          {
            botId: 'bot-1',
            botName: 'Support Agent',
            usedBytes: 2 * 1024 * 1024,
            maxBytes: 5 * 1024 * 1024,
            usedMb: 2,
            maxMb: 5,
            percentUsed: 40,
          },
        ],
        totalUsedBytes: 2 * 1024 * 1024,
        note: TRAINED_KNOWLEDGE_STORAGE_HELPER,
      },
    },
    planCatalog: [],
    addonCatalog: [
      {
        key: 'extra_bot',
        name: 'Extra bot',
        billingInterval: 'monthly',
        priceUsd: 49,
        scope: 'workspace',
        checkoutAvailable: false,
      },
    ],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <UsagePage />
    </MemoryRouter>,
  );
}

describe('UsagePage', () => {
  beforeEach(() => {
    mockCustomer = baseCustomer;
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
    expect(
      await screen.findByText('Track your workspace limits, AI credits, and trained knowledge storage.'),
    ).toBeTruthy();
  });

  it('renders header plan and subscription status chips', async () => {
    renderPage();
    expect(await screen.findByText('Free plan')).toBeTruthy();
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(1);
  });

  it('renders redesigned metric cards with AI credits progress', async () => {
    renderPage();
    expect(await screen.findByText('10 used')).toBeTruthy();
    expect(screen.getByText(/40 remaining · 50 included this period/i)).toBeTruthy();
    expect(screen.getByLabelText('AI credits used this billing period')).toBeTruthy();
    expect(screen.getByText('1 of 1')).toBeTruthy();
    expect(screen.getByText('3 of 3')).toBeTruthy();
    expect(screen.getByText('Includes pending invites.')).toBeTruthy();
    expect(screen.getByText(TRAINED_KNOWLEDGE_STORAGE_LABEL)).toBeTruthy();
  });

  it('renders usage trend chart section', async () => {
    renderPage();
    expect(await screen.findByText('Usage trend')).toBeTruthy();
    expect(screen.getByText('Estimated from current billing-period usage.')).toBeTruthy();
    expect(screen.getByTestId('usage-credits-chart')).toBeTruthy();
  });

  it('renders AI credits by agent with share of total', async () => {
    renderPage();
    expect(await screen.findByText('AI credits by agent')).toBeTruthy();
    expect(screen.getAllByText('Support Agent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Share of total')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('renders trained knowledge by agent table', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('Support Agent').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('2 MB').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('5 MB').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('40%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(TRAINED_KNOWLEDGE_STORAGE_HELPER).length).toBeGreaterThan(0);
  });

  it('renders no-usage empty state for AI credits', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary({
        usage: {
          ...buildSummary().usage,
          aiCredits: {
            ...buildSummary().usage.aiCredits,
            monthlyCreditsUsed: 0,
            byBot: [],
          },
        },
      }),
    });
    renderPage();
    expect(await screen.findByText('No AI credit usage yet.')).toBeTruthy();
  });

  it('shows over-limit warning on AI credits metric card', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary({
        usage: {
          ...buildSummary().usage,
          aiCredits: {
            ...buildSummary().usage.aiCredits,
            monthlyCreditsUsed: 60,
            monthlyCreditsRemaining: 0,
            totalCreditsRemaining: 0,
            isOverLimit: true,
          },
        },
      }),
    });
    renderPage();
    expect(
      await screen.findByText('You are over your included AI credits for this period.'),
    ).toBeTruthy();
  });

  it('shows loading skeleton while fetching', async () => {
    mockGetWorkspaceBillingSummary.mockImplementation(
      () => new Promise(() => {
        /* never resolves */
      }),
    );
    renderPage();
    expect(await screen.findByLabelText('Loading usage')).toBeTruthy();
  });

  it('refetches when active workspace changes', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetWorkspaceBillingSummary).toHaveBeenCalledWith('ws-1');
    });

    mockCustomer = {
      ...baseCustomer,
      activeWorkspaceId: 'ws-2',
      workspaceIds: ['ws-1', 'ws-2'],
      workspaces: [
        { ...baseWorkspace, id: 'ws-1', role: 'member' },
        { ...baseWorkspace, id: 'ws-2', name: 'Beta', role: 'member' },
      ],
    };

    cleanup();
    renderPage();

    await waitFor(() => {
      expect(mockGetWorkspaceBillingSummary).toHaveBeenCalledWith('ws-2');
    });
  });

  it('handles API error with retry', async () => {
    mockGetWorkspaceBillingSummary
      .mockResolvedValueOnce({ ok: false, error: 'Network error' })
      .mockResolvedValueOnce({ ok: true, data: buildSummary() });

    renderPage();
    expect(await screen.findByText('Could not load usage')).toBeTruthy();
    expect(screen.getByText('Network error')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('10 used')).toBeTruthy();
  });

  it('shows empty state when no active workspace is selected', async () => {
    mockCustomer = { ...baseCustomer, activeWorkspaceId: null, workspaces: [] };
    renderPage();
    expect(await screen.findByText('No active workspace selected.')).toBeTruthy();
    expect(mockGetWorkspaceBillingSummary).not.toHaveBeenCalled();
  });

  it('shows add-ons preview as coming soon', async () => {
    renderPage();
    expect(await screen.findByText('Available add-ons')).toBeTruthy();
    expect(screen.getByText('Add-ons are not available yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Coming soon' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Extra bot')).toBeTruthy();
  });
});
