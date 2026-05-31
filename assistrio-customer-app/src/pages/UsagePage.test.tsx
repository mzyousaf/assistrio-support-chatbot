import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe, WorkspaceBillingSummary, WorkspaceUsageAnalytics } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements, mockTrialWorkspaceSummary } from '@/lib/planEntitlements';
import {
  TRAINED_KNOWLEDGE_STORAGE_HELPER,
  TRAINED_KNOWLEDGE_STORAGE_LABEL,
} from '@/lib/trainedKnowledgeStorageCopy';
import { UsagePage } from './UsagePage';

const mockGetWorkspaceBillingSummary = vi.fn();
const mockGetWorkspaceUsageAnalytics = vi.fn();
const mockGetCustomerBots = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getWorkspaceBillingSummary: (...args: unknown[]) => mockGetWorkspaceBillingSummary(...args),
  getWorkspaceUsageAnalytics: (...args: unknown[]) => mockGetWorkspaceUsageAnalytics(...args),
  getCustomerBots: (...args: unknown[]) => mockGetCustomerBots(...args),
  createAddonCheckoutSession: vi.fn(),
  createTopUpCheckoutSession: vi.fn(),
  cancelWorkspaceAddon: vi.fn(),
  patchWorkspaceCreditAutoTopUp: vi.fn(),
  createAutoTopUpCheckoutSession: vi.fn(),
  disableWorkspaceAutoTopUp: vi.fn(),
}));

vi.mock('@/lib/app-toast', () => ({
  appToast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="recharts-responsive">{children}</div>
  ),
  ComposedChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="usage-composed-chart">{children}</div>
  ),
  PieChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="usage-agent-pie-chart">{children}</div>
  ),
  Area: () => null,
  Line: () => null,
  Bar: () => null,
  Pie: ({ children }: { children?: ReactNode }) => <g>{children}</g>,
  Cell: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  defs: ({ children }: { children: ReactNode }) => <svg>{children}</svg>,
  linearGradient: ({ children }: { children: ReactNode }) => <g>{children}</g>,
  stop: () => null,
}));

const baseWorkspace = mockTrialWorkspaceSummary({ role: undefined });

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

vi.mock('@/components/billing/UpgradePlanModalProvider', () => ({
  useUpgradePlanModal: () => ({
    openUpgradeModal: vi.fn(),
    closeUpgradeModal: vi.fn(),
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
    subscription: mockBillingSubscription(),
    entitlements: mockTrialBillingEntitlements(),
    usage: {
      bots: { current: 1, limit: 1 },
      members: { current: 1, pendingInvites: 0, used: 1, limit: 1 },
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
    planCatalog: [
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
        checkoutAvailable: true,
      },
    ],
    addonCatalog: [
      {
        key: 'extra_bot',
        name: 'Extra bot',
        billingInterval: 'monthly',
        priceUsd: 49,
        scope: 'workspace',
        checkoutAvailable: true,
        status: 'inactive',
        description: 'Adds one extra agent.',
      },
      {
        key: 'ai_credits_1000',
        name: '1,000 extra AI credits',
        billingInterval: 'one_time',
        priceUsd: 30,
        scope: 'workspace',
        checkoutAvailable: true,
        status: 'inactive',
        description: 'Used after monthly credits.',
      },
    ],
    activeAddons: [],
    topUps: [],
    ...overrides,
  };
}

function buildAnalytics(overrides?: Partial<WorkspaceUsageAnalytics>): WorkspaceUsageAnalytics {
  return {
    dateRange: { startDate: '2026-05-25', endDate: '2026-05-31' },
    usageTrend: [
      {
        date: '2026-05-30',
        totalCreditsUsed: 10,
        monthlyCreditsUsed: 10,
        topUpCreditsUsed: 0,
      },
    ],
    aiCreditsByAgent: [
      {
        botId: 'bot-1',
        botName: 'Support Agent',
        totalCreditsUsed: 10,
        monthlyCreditsUsed: 10,
        topUpCreditsUsed: 0,
        messageCount: 4,
      },
    ],
    trainedKnowledgeByAgent: [
      {
        botId: 'bot-1',
        botName: 'Support Agent',
        usedMb: 2,
        maxMb: 5,
        percentUsed: 40,
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
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);

    mockCustomer = baseCustomer;
    mockGetWorkspaceBillingSummary.mockResolvedValue({ ok: true, data: buildSummary() });
    mockGetWorkspaceUsageAnalytics.mockResolvedValue({ ok: true, data: buildAnalytics() });
    mockGetCustomerBots.mockResolvedValue({
      ok: true,
      data: [
        {
          _id: 'bot-1',
          name: 'Support Agent',
          agentsPackAgent: false,
          category: 'support',
          status: 'published',
          isPublic: true,
          visibility: 'public',
          createdAt: null,
          slug: 'support-agent',
          primaryColor: '#0d9488',
          workspaceId: 'ws-1',
        },
      ],
    });
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
      await screen.findByText(
        'Track workspace limits, AI credits, agent usage, and trained knowledge storage.',
      ),
    ).toBeTruthy();
  });

  it('renders header plan tag with icon and status-driven color', async () => {
    renderPage();
    expect(await screen.findByText('Free trial')).toBeTruthy();
    expect(screen.getByText('50 trial credits total')).toBeTruthy();
    expect(screen.queryByText('Free trial plan')).toBeNull();
  });

  it('renders metric cards with circular progress and without top trained knowledge card', async () => {
    renderPage();
    expect(await screen.findByText('10 / 50')).toBeTruthy();
    expect(screen.getByText('Trial credits used')).toBeTruthy();
    expect(screen.queryByText(/Resets/i)).toBeNull();
    expect(screen.getAllByText(/Trial credits do not renew/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Trial AI credits used')).toBeTruthy();
    expect(screen.getAllByText('1 / 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Includes pending invites.')).toBeTruthy();

    const metricTitles = screen
      .getAllByRole('heading', { level: 2 })
      .map((node) => node.textContent?.trim());
    expect(metricTitles).toContain('Trial AI credits');
    expect(metricTitles).toContain('Agents');
    expect(metricTitles).toContain('Members');
    expect(metricTitles).not.toContain('Top-up credits');
    expect(metricTitles).not.toContain(TRAINED_KNOWLEDGE_STORAGE_LABEL);
  });

  it('renders top-up credits card when purchased top-up credits exist', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary({
        usage: {
          ...buildSummary().usage,
          aiCredits: {
            ...buildSummary().usage.aiCredits,
            monthlyCredits: 500,
            monthlyCreditsUsed: 0,
            monthlyCreditsRemaining: 500,
            topUpCreditsRemaining: 1000,
            totalCreditsRemaining: 1500,
          },
        },
        topUps: [
          {
            creditsPurchased: 1000,
            creditsRemaining: 1000,
            expiresAt: '2027-05-29T00:00:00.000Z',
            createdAt: '2026-05-01T00:00:00.000Z',
          },
        ],
      }),
    });
    renderPage();
    expect(await screen.findByText('0 / 500')).toBeTruthy();
    expect(screen.getByText('0 / 1,000')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Top-up credits' })).toBeTruthy();
    expect(screen.getByText('Purchased credit balance')).toBeTruthy();
    expect(screen.getByLabelText('Top-up credits used')).toBeTruthy();
    expect(screen.getByText(/Expires/i)).toBeTruthy();
    expect(screen.getByText('Reserve')).toBeTruthy();
  });

  it('hides top-up credits card when remaining credits have no purchase records', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary({
        usage: {
          ...buildSummary().usage,
          aiCredits: {
            ...buildSummary().usage.aiCredits,
            topUpCreditsRemaining: 1000,
            totalCreditsRemaining: 1040,
          },
        },
        topUps: [],
      }),
    });
    renderPage();
    expect(await screen.findByText('10 / 50')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Top-up credits' })).toBeNull();
  });

  it('hides top-up credits card when no top-up credits exist', async () => {
    renderPage();
    expect(await screen.findByText('10 / 50')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Top-up credits' })).toBeNull();
    expect(screen.queryByText('Purchased credit balance')).toBeNull();
  });

  it('renders AI credits usage trends chart with toggle, legend, and date filter', async () => {
    renderPage();
    expect(await screen.findByText('AI Credits Usage Trends')).toBeTruthy();
    expect(screen.getByTestId('usage-trend-full-width')).toBeTruthy();
    expect(await screen.findByTestId('usage-credits-trend-chart')).toBeTruthy();
    expect(screen.getByTestId('usage-credits-series-legend')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Trends' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Date range')).toBeTruthy();
    expect(screen.getByText('Agent')).toBeTruthy();
    expect(screen.getByText('All agents')).toBeTruthy();
    await waitFor(() => {
      expect(mockGetWorkspaceUsageAnalytics).toHaveBeenCalled();
    });
  });

  it('refetches analytics when date range changes', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetWorkspaceUsageAnalytics).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByText('Date range'));
    fireEvent.click(screen.getByRole('option', { name: 'Last 30 days' }));

    await waitFor(() => {
      expect(mockGetWorkspaceUsageAnalytics.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('switches chart to stacked heights view', async () => {
    renderPage();
    expect(await screen.findByTestId('usage-credits-trend-chart')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Heights' }));
    expect(await screen.findByText('AI Credits Usage Heights')).toBeTruthy();
    expect(await screen.findByTestId('usage-credits-heights-chart')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Total credits/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Heights' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles chart series from the legend', async () => {
    renderPage();
    expect(await screen.findByTestId('usage-credits-series-legend')).toBeTruthy();
    const monthlyToggle = screen.getByRole('button', { name: /Monthly credits/i });
    expect(monthlyToggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(monthlyToggle);
    expect(monthlyToggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders AI credits by agent and trained knowledge in a two-column row', async () => {
    renderPage();
    const agentRow = await screen.findByTestId('usage-agent-usage-row');
    expect(agentRow).toBeTruthy();
    expect(await screen.findByText('AI credits by agent')).toBeTruthy();
    expect(await screen.findByTestId('usage-agent-credits-donut')).toBeTruthy();
    expect(screen.getByTestId('usage-agent-pie-chart')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: `${TRAINED_KNOWLEDGE_STORAGE_LABEL} by agent`,
      }),
    ).toBeTruthy();
    expect(agentRow.contains(screen.getByText('AI credits by agent').closest('section')!)).toBe(true);
    expect(
      agentRow.contains(
        screen
          .getByRole('heading', { name: `${TRAINED_KNOWLEDGE_STORAGE_LABEL} by agent` })
          .closest('section')!,
      ),
    ).toBe(true);
  });

  it('renders AI credits by agent donut chart and legend', async () => {
    renderPage();
    expect(await screen.findByText('AI credits by agent')).toBeTruthy();
    expect(await screen.findByTestId('usage-agent-credits-donut')).toBeTruthy();
    expect(screen.getByTestId('usage-agent-pie-chart')).toBeTruthy();
    expect(screen.getAllByText('Support Agent').length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText(/10 credits/i)).toBeTruthy();
    expect(await screen.findByText(/4 messages/i)).toBeTruthy();
  });

  it('renders trained knowledge storage by agent section', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', {
        name: `${TRAINED_KNOWLEDGE_STORAGE_LABEL} by agent`,
      }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(mockGetCustomerBots).toHaveBeenCalledWith({ workspaceId: 'ws-1', status: 'all' });
    });
    expect(screen.getAllByText('Support Agent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2 MB used · 5 MB limit')).toBeTruthy();
    expect(screen.getAllByText(TRAINED_KNOWLEDGE_STORAGE_HELPER).length).toBeGreaterThan(0);
  });

  it('renders no-usage empty state for AI credits', async () => {
    mockGetWorkspaceUsageAnalytics.mockResolvedValue({
      ok: true,
      data: buildAnalytics({ aiCreditsByAgent: [], usageTrend: [] }),
    });
    renderPage();
    expect((await screen.findAllByText('No AI credit usage in this date range.')).length).toBeGreaterThan(0);
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
    expect(screen.getByTestId('usage-metric-cards-skeleton')).toBeTruthy();
    expect(
      screen.getByTestId('usage-metric-cards-skeleton').querySelectorAll('article').length,
    ).toBe(3);
    expect(screen.getByTestId('usage-trend-skeleton')).toBeTruthy();
    expect(screen.getByTestId('usage-agent-usage-row-skeleton')).toBeTruthy();
    expect(screen.getByTestId('usage-agent-credits-skeleton')).toBeTruthy();
    expect(screen.getByTestId('usage-knowledge-skeleton')).toBeTruthy();
    expect(screen.getByTestId('usage-addons-skeleton')).toBeTruthy();
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

    expect(await screen.findByText('10 / 50')).toBeTruthy();
  });

  it('shows empty state when no active workspace is selected', async () => {
    mockCustomer = { ...baseCustomer, activeWorkspaceId: null, workspaces: [] };
    renderPage();
    expect(await screen.findByText('No active workspace selected.')).toBeTruthy();
    expect(mockGetWorkspaceBillingSummary).not.toHaveBeenCalled();
  });

  it('shows the same add-ons section as Billing & Plans', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Add-ons' })).toBeTruthy();
    expect(
      screen.getByText('Workspace extras, recurring add-ons, and credit top-ups.'),
    ).toBeTruthy();
    expect(screen.getAllByText(/Add-ons are available on paid plans/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Extra AI Agent')).toBeTruthy();
    expect(screen.getByText('1,000 extra AI credits')).toBeTruthy();
    expect(screen.getByTestId('billing-addons-compact-row')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Buy credits' })).toBeNull();
  });

  it('shows auto top-up controls and credit usage order copy in add-ons', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary({
        autoTopUp: {
          status: 'active',
          enabled: true,
          checkoutAvailable: true,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          packsThisBillingPeriod: 0,
          maxPacksPerBillingPeriod: 5,
          packCredits: 1000,
          packPriceUsd: 30,
        },
      }),
    });

    renderPage();
    expect(await screen.findByText('Status: Active')).toBeTruthy();
    expect(
      screen.getByText(
        /Monthly credits are used first\. Existing top-up credits are used second\. Auto top-up runs only when both are exhausted\./,
      ),
    ).toBeTruthy();
  });
});
