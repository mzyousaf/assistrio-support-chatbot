import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe, WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements, mockTrialWorkspaceSummary } from '@/lib/planEntitlements';
import {
  TRAINED_KNOWLEDGE_STORAGE_HELPER,
  TRAINED_KNOWLEDGE_STORAGE_LABEL,
} from '@/lib/trainedKnowledgeStorageCopy';
import { UsagePage } from './UsagePage';

const mockGetWorkspaceBillingSummary = vi.fn();
const mockGetCustomerBots = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getWorkspaceBillingSummary: (...args: unknown[]) => mockGetWorkspaceBillingSummary(...args),
  getCustomerBots: (...args: unknown[]) => mockGetCustomerBots(...args),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="recharts-responsive">{children}</div>
  ),
  AreaChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="usage-credits-area-chart">{children}</div>
  ),
  BarChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="usage-credits-bar-chart">{children}</div>
  ),
  PieChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="usage-agent-pie-chart">{children}</div>
  ),
  Area: () => null,
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
    activeAddons: [],
    topUps: [],
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

  it('renders header plan and subscription status chips', async () => {
    renderPage();
    expect(await screen.findByText('Free trial plan')).toBeTruthy();
    expect(screen.getAllByText('Free trial').length).toBeGreaterThanOrEqual(1);
  });

  it('renders metric cards with circular progress and without top trained knowledge card', async () => {
    renderPage();
    expect(await screen.findByText('10 / 50 monthly used')).toBeTruthy();
    expect(screen.getByText(/40 total remaining/)).toBeTruthy();
    expect(screen.getByText(/Trial credits do not renew/i)).toBeTruthy();
    expect(screen.getByLabelText('Trial AI credits used')).toBeTruthy();
    expect(screen.getAllByText('1 / 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Includes pending invites.')).toBeTruthy();

    const metricTitles = screen
      .getAllByRole('heading', { level: 2 })
      .map((node) => node.textContent?.trim());
    expect(metricTitles).toContain('AI credits');
    expect(metricTitles).toContain('Agents');
    expect(metricTitles).toContain('Members');
    expect(metricTitles).not.toContain(TRAINED_KNOWLEDGE_STORAGE_LABEL);
  });

  it('renders usage trend chart by default with toggle and date filter', async () => {
    renderPage();
    expect(await screen.findByText('Usage trend')).toBeTruthy();
    expect(screen.getByTestId('usage-trend-full-width')).toBeTruthy();
    expect(screen.getByText('Estimated from current billing-period usage.')).toBeTruthy();
    expect(screen.getByTestId('usage-credits-trend-chart')).toBeTruthy();
    expect(screen.getByTestId('usage-credits-area-chart')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Trend' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Date range')).toBeTruthy();
    expect(screen.getByText('Agent')).toBeTruthy();
    expect(screen.getByText('All agents')).toBeTruthy();
    expect(screen.queryByText('Remaining')).toBeNull();
    expect(screen.queryByText('Included')).toBeNull();
  });

  it('switches usage trend card to highlights bar view', async () => {
    renderPage();
    expect(await screen.findByTestId('usage-credits-trend-chart')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Highlights' }));
    expect(screen.getByTestId('usage-credits-highlights-chart')).toBeTruthy();
    expect(screen.getByTestId('usage-credits-bar-chart')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Highlights' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('renders AI credits by agent and trained knowledge in a two-column row', async () => {
    renderPage();
    const agentRow = await screen.findByTestId('usage-agent-usage-row');
    expect(agentRow).toBeTruthy();
    expect(screen.getByText('AI credits by agent')).toBeTruthy();
    expect(screen.getByTestId('usage-agent-credits-donut')).toBeTruthy();
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
    expect(screen.getByTestId('usage-agent-credits-donut')).toBeTruthy();
    expect(screen.getByTestId('usage-agent-pie-chart')).toBeTruthy();
    expect(screen.getAllByText('Support Agent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('10 credits')).toBeTruthy();
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

    expect(await screen.findByText('10 / 50 monthly used')).toBeTruthy();
  });

  it('shows empty state when no active workspace is selected', async () => {
    mockCustomer = { ...baseCustomer, activeWorkspaceId: null, workspaces: [] };
    renderPage();
    expect(await screen.findByText('No active workspace selected.')).toBeTruthy();
    expect(mockGetWorkspaceBillingSummary).not.toHaveBeenCalled();
  });

  it('shows add-ons preview as full-width disabled cards', async () => {
    renderPage();
    expect(await screen.findByText('Available add-ons')).toBeTruthy();
    expect(
      screen.getByText(/Purchase add-ons from Plans or manage active add-ons on Billing/i),
    ).toBeTruthy();
    expect(screen.getByText('Add-ons are available on paid plans')).toBeTruthy();
    expect(screen.getByText('Extra agent')).toBeTruthy();
    expect(screen.getByText('$49 per month')).toBeTruthy();
    expect(screen.getAllByText('Auto charge').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('switch', { hidden: true }).length).toBeGreaterThan(0);
  });
});
