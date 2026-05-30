import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe, WorkspaceBillingSummary } from '@/api/types';
import { TRAINED_KNOWLEDGE_STORAGE_HELPER } from '@/lib/trainedKnowledgeStorageCopy';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements, mockTrialWorkspaceSummary } from '@/lib/planEntitlements';
import { TRAINED_KNOWLEDGE_UPLOAD_HELPER } from '@/pages/billing/billingPlanComparisonCopy';
import { PlansPage } from './PlansPage';

const mockGetWorkspaceBillingSummary = vi.fn();
const mockChangeWorkspaceSubscriptionPlan = vi.fn();
const mockCreatePlanCheckoutSession = vi.fn();
const mockCreateAddonCheckoutSession = vi.fn();
const mockCreateTopUpCheckoutSession = vi.fn();
const mockGetCustomerBots = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getWorkspaceBillingSummary: (...args: unknown[]) => mockGetWorkspaceBillingSummary(...args),
  changeWorkspaceSubscriptionPlan: (...args: unknown[]) =>
    mockChangeWorkspaceSubscriptionPlan(...args),
  createPlanCheckoutSession: (...args: unknown[]) => mockCreatePlanCheckoutSession(...args),
  createAddonCheckoutSession: (...args: unknown[]) => mockCreateAddonCheckoutSession(...args),
  createTopUpCheckoutSession: (...args: unknown[]) => mockCreateTopUpCheckoutSession(...args),
  getCustomerBots: (...args: unknown[]) => mockGetCustomerBots(...args),
}));

vi.mock('@/lib/app-toast', () => ({
  appToast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
}));

const baseWorkspace = mockTrialWorkspaceSummary();

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

function buildSummary(
  overrides?: Partial<WorkspaceBillingSummary>,
  options?: { checkoutAvailable?: boolean },
): WorkspaceBillingSummary {
  const checkoutAvailable = options?.checkoutAvailable ?? false;
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
    activeAddons: [],
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
        checkoutAvailable: false,
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
        checkoutAvailable,
      },
      {
        key: 'pro',
        name: 'Pro',
        priceMonthly: 99,
        botLimit: 1,
        memberLimit: 5,
        monthlyAiCredits: 2000,
        kbStorageMbPerBot: 30,
        analyticsHistoryDays: null,
        canExportReports: true,
        checkoutAvailable,
      },
    ],
    addonCatalog: [
      {
        key: 'ai_credits_1000',
        name: '1,000 extra AI credits',
        billingInterval: 'one_time',
        priceUsd: 30,
        scope: 'workspace',
        checkoutAvailable,
      },
      {
        key: 'extra_bot',
        name: 'Extra bot',
        billingInterval: 'monthly',
        priceUsd: 49,
        scope: 'workspace',
        checkoutAvailable,
      },
      {
        key: 'remove_branding',
        name: 'Remove Powered by Assistrio',
        billingInterval: 'monthly',
        priceUsd: 20,
        scope: 'workspace',
        checkoutAvailable,
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

function cardForPlan(plansRegion: HTMLElement, planName: string) {
  const heading = within(plansRegion).getByRole('heading', { name: planName, level: 3 });
  const card = heading.closest('article');
  expect(card).toBeTruthy();
  return within(card!);
}

describe('PlansPage', () => {
  beforeEach(() => {
    mockCustomer = ownerCustomer;
    mockGetWorkspaceBillingSummary.mockResolvedValue({ ok: true, data: buildSummary() });
    mockCreatePlanCheckoutSession.mockResolvedValue({
      ok: true,
      data: { checkoutUrl: 'https://pay.example/checkout', provider: 'lemon_squeezy' },
    });
    mockCreateAddonCheckoutSession.mockResolvedValue({
      ok: true,
      data: { checkoutUrl: 'https://pay.example/addon', provider: 'lemon_squeezy' },
    });
    mockCreateTopUpCheckoutSession.mockResolvedValue({
      ok: true,
      data: { checkoutUrl: 'https://pay.example/topup', provider: 'lemon_squeezy' },
    });
    mockGetCustomerBots.mockResolvedValue({
      ok: true,
      data: [{ _id: 'bot-1', name: 'Support', agentsPackAgent: false }],
    });
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
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
      await screen.findByText('Choose the plan and add-ons that fit your workspace.'),
    ).toBeTruthy();
    expect(screen.getByText('Checkout is not enabled yet.')).toBeTruthy();
  });

  it('does not render removed sections', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Plans' });
    expect(screen.queryByRole('heading', { name: 'About trained knowledge storage' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Trained knowledge guide' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Free', level: 2 })).toBeNull();
  });

  it('renders grouped feature comparison table below pricing cards', async () => {
    renderPage();
    const comparison = within(
      await screen.findByRole('region', { name: 'What each plan includes' }),
    );
    expect(comparison.getByText('Compare Free, Starter, and Pro at a glance.')).toBeTruthy();
    expect(comparison.getByText('Core limits')).toBeTruthy();
    expect(comparison.getByText('Analytics & exports')).toBeTruthy();
    expect(comparison.getByText('Widget & sharing')).toBeTruthy();
    expect(comparison.getByText('Messaging')).toBeTruthy();
    expect(comparison.getByText('Leads')).toBeTruthy();
    expect(comparison.getByText('Collaboration & support')).toBeTruthy();
    expect(comparison.getByRole('rowheader', { name: 'Basic analytics' })).toBeTruthy();
    expect(comparison.queryByRole('rowheader', { name: 'Conversations Coverage' })).toBeNull();
    expect(comparison.queryByRole('rowheader', { name: 'Leads Coverage' })).toBeNull();
    expect(comparison.queryByRole('rowheader', { name: 'History' })).toBeNull();
    expect(comparison.queryByRole('rowheader', { name: 'Analytics' })).toBeNull();
    expect(comparison.getByRole('rowheader', { name: 'Export reports' })).toBeTruthy();
    expect(comparison.getByRole('rowheader', { name: 'Agent-level access' })).toBeTruthy();
    expect(comparison.getByRole('rowheader', { name: 'Member-level access' })).toBeTruthy();
    expect(comparison.queryByRole('rowheader', { name: 'Export leads' })).toBeNull();
    expect(comparison.getAllByLabelText('Included').length).toBeGreaterThan(0);
    expect(comparison.getAllByLabelText('Not included').length).toBeGreaterThanOrEqual(2);
    expect(comparison.queryByText('Included', { selector: 'span' })).toBeNull();
    expect(comparison.getAllByText('7 days').length).toBeGreaterThan(0);
    expect(comparison.getAllByText('Unlimited').length).toBeGreaterThan(0);
    expect(comparison.queryByText('Feature')).toBeNull();
    expect(comparison.queryByText('Current')).toBeNull();
  });

  it('renders pricing cards for Free, Starter, and Pro', async () => {
    renderPage();
    const plans = within(await screen.findByRole('region', { name: 'Plans' }));
    expect(plans.getByRole('heading', { name: '7-day free trial', level: 3 })).toBeTruthy();
    expect(plans.getByRole('heading', { name: 'Starter', level: 3 })).toBeTruthy();
    expect(plans.getByRole('heading', { name: 'Pro', level: 3 })).toBeTruthy();
    expect(plans.queryByRole('heading', { name: 'Free', level: 3 })).toBeNull();
    expect(plans.getByText('$0')).toBeTruthy();
    expect(plans.getByText('$49')).toBeTruthy();
    expect(plans.getByText('$99')).toBeTruthy();
    expect(plans.getAllByText('per month').length).toBeGreaterThanOrEqual(3);
    expect(plans.getByText('Start testing Assistrio')).toBeTruthy();
    expect(plans.getByText('Best for testing')).toBeTruthy();
    expect(
      plans.getByText('Auto-expires after 7 days or when included AI credits run out.'),
    ).toBeTruthy();
    expect(plans.getByText('Best value for small businesses')).toBeTruthy();
    expect(plans.getByText('Best value for growing business')).toBeTruthy();
    expect(plans.getAllByText('Priority support').length).toBe(1);
  });

  it('renders why-plan sections on each pricing card', async () => {
    renderPage();
    const plansRegion = await screen.findByRole('region', { name: 'Plans' });

    const freeCard = cardForPlan(plansRegion, '7-day free trial');
    expect(freeCard.getByRole('heading', { name: 'Why Free?', level: 4 })).toBeTruthy();
    expect(freeCard.getByText('Test your first AI agent')).toBeTruthy();
    expect(freeCard.getByText('Good for early validation')).toBeTruthy();
    expect(freeCard.queryByText('1 agent')).toBeNull();

    const starterCard = cardForPlan(plansRegion, 'Starter');
    expect(starterCard.getByRole('heading', { name: 'Why Starter?', level: 4 })).toBeTruthy();
    expect(starterCard.getByText('10x more AI credits than Free')).toBeTruthy();
    expect(starterCard.getByText('Export reports and leads')).toBeTruthy();

    const proCard = cardForPlan(plansRegion, 'Pro');
    expect(proCard.getByRole('heading', { name: 'Why Pro?', level: 4 })).toBeTruthy();
    expect(proCard.getByText('2,000 AI credits/month')).toBeTruthy();
    expect(proCard.getByText('30 MB trained knowledge storage')).toBeTruthy();
    expect(proCard.getByText('Best for larger teams and higher traffic')).toBeTruthy();
    expect(proCard.getByText('10 workspace members')).toBeTruthy();
    expect(proCard.queryByText('5 members')).toBeNull();
  });

  it('shows plan limit lines in the comparison table core limits section', async () => {
    renderPage();
    const comparison = within(
      await screen.findByRole('region', { name: 'What each plan includes' }),
    );
    expect(comparison.getByRole('rowheader', { name: 'Agents' })).toBeTruthy();
    expect(comparison.getByRole('rowheader', { name: 'Workspace members' })).toBeTruthy();
    expect(comparison.getByRole('rowheader', { name: 'AI credits' })).toBeTruthy();
    expect(comparison.getByRole('rowheader', { name: 'Trained knowledge storage / bot' })).toBeTruthy();
    expect(comparison.queryByRole('rowheader', { name: 'Analytics history' })).toBeNull();
    expect(comparison.getByText('50 trial credits total')).toBeTruthy();
    expect(comparison.queryByText('50 Credits only')).toBeNull();
    expect(comparison.queryByText('50 AI credits / month')).toBeNull();
    expect(comparison.queryByText('50 credits monthly')).toBeNull();
    expect(comparison.getByText('500 AI credits / month')).toBeTruthy();
    expect(comparison.getByText('2,000 AI credits / month')).toBeTruthy();
    expect(comparison.getByText(TRAINED_KNOWLEDGE_UPLOAD_HELPER)).toBeTruthy();
    expect(comparison.getByText('Voice, dictation, and chat use AI credits.')).toBeTruthy();
    expect(comparison.getByText('5 MB')).toBeTruthy();
    expect(comparison.getByText('15 MB')).toBeTruthy();
    expect(comparison.getByText('30 MB')).toBeTruthy();

    const plansRegion = await screen.findByRole('region', { name: 'Plans' });
    const freeCard = cardForPlan(plansRegion, '7-day free trial');
    expect(freeCard.getAllByText('Capture leads').length).toBe(1);
  });

  it('shows current plan indicator and button on the Free pricing card', async () => {
    renderPage();
    const plansRegion = await screen.findByRole('region', { name: 'Plans' });
    const freeHeading = within(plansRegion).getByRole('heading', {
      name: '7-day free trial',
      level: 3,
    });
    const freeArticle = freeHeading.closest('article');
    expect(freeArticle?.getAttribute('aria-current')).toBe('true');
    const freeCard = within(freeArticle!);
    expect(freeCard.getByRole('button', { name: 'Current plan' }).hasAttribute('disabled')).toBe(true);
    expect(freeCard.queryByText('Your current plan')).toBeNull();
  });

  it('does not repeat long feature lists on pricing cards', async () => {
    renderPage();
    const plansRegion = await screen.findByRole('region', { name: 'Plans' });
    const freeCard = cardForPlan(plansRegion, '7-day free trial');
    expect(freeCard.queryByText('Export reports')).toBeNull();
    expect(freeCard.queryByText('Voice messages (uses AI credits)')).toBeNull();
  });

  it('does not repeat Included on pricing card rows', async () => {
    renderPage();
    const plans = within(await screen.findByRole('region', { name: 'Plans' }));
    expect(plans.queryByText('Included')).toBeNull();
  });

  it('renders add-ons using the Usage page add-on card', async () => {
    renderPage();
    const addons = within(await screen.findByRole('region', { name: 'Add-ons' }));
    expect(addons.getByText('Add capacity when your workspace grows.')).toBeTruthy();
    expect(addons.getByRole('heading', { name: '1,000 extra AI credits', level: 3 })).toBeTruthy();
    expect(addons.getByRole('heading', { name: 'Extra agent', level: 3 })).toBeTruthy();
    expect(addons.getByRole('heading', { name: 'Remove Powered by Assistrio', level: 3 })).toBeTruthy();
    expect(addons.queryByRole('heading', { name: '+5 MB trained KB storage', level: 3 })).toBeNull();
    expect(addons.queryByRole('heading', { name: '+10 MB trained KB storage', level: 3 })).toBeNull();
    expect(addons.getAllByText('Available on paid plans.').length).toBeGreaterThanOrEqual(3);
    expect(addons.queryByText('Auto charge')).toBeNull();
  });

  it('shows owner billing note in header when checkout is unavailable', async () => {
    renderPage();
    expect(await screen.findByText('Checkout is not enabled yet.')).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Billing period' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Monthly/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('Pro owner sees Downgrade to Starter instead of portal', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary(
        {
          plan: {
            key: 'pro',
            name: 'Pro',
            priceMonthly: 99,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          },
          entitlements: {
            ...mockTrialBillingEntitlements(),
            isTrialPlan: false,
            addonsAllowed: true,
            creditsRenewMonthly: true,
          },
          subscription: mockBillingSubscription({
            subscriptionStatus: 'active',
            hasActivePaidSubscription: true,
          }),
        },
        { checkoutAvailable: true },
      ),
    });
    renderPage();
    const plansRegion = await screen.findByRole('region', { name: 'Plans' });
    expect(within(plansRegion).queryByRole('heading', { name: '7-day free trial', level: 3 })).toBeNull();
    const starterCard = cardForPlan(plansRegion, 'Starter');
    expect(starterCard.getByRole('button', { name: 'Downgrade to Starter' })).toBeTruthy();
    expect(starterCard.queryByRole('button', { name: 'Manage billing' })).toBeNull();
  });

  it('Starter owner sees Upgrade to Pro', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary(
        {
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          },
          entitlements: {
            ...mockTrialBillingEntitlements(),
            isTrialPlan: false,
            addonsAllowed: true,
            creditsRenewMonthly: true,
          },
          subscription: mockBillingSubscription({
            subscriptionStatus: 'active',
            hasActivePaidSubscription: true,
          }),
        },
        { checkoutAvailable: true },
      ),
    });
    renderPage();
    const plansRegion = await screen.findByRole('region', { name: 'Plans' });
    const proCard = cardForPlan(plansRegion, 'Pro');
    expect(proCard.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
  });

  it('owner sees enabled upgrade button when checkoutAvailable=true', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary(undefined, { checkoutAvailable: true }),
    });
    renderPage();
    const plans = within(await screen.findByRole('region', { name: 'Plans' }));
    const starterButton = within(plans.getByRole('heading', { name: 'Starter', level: 3 }).closest('article')!).getByRole(
      'button',
      { name: 'Upgrade to Starter' },
    );
    expect((starterButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('clicking upgrade calls plan checkout API and redirects', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary(undefined, { checkoutAvailable: true }),
    });
    renderPage();
    const plans = within(await screen.findByRole('region', { name: 'Plans' }));
    fireEvent.click(
      within(plans.getByRole('heading', { name: 'Starter', level: 3 }).closest('article')!).getByRole('button', {
        name: 'Upgrade to Starter',
      }),
    );
    await waitFor(() => {
      expect(mockCreatePlanCheckoutSession).toHaveBeenCalledWith('ws-1', 'starter');
      expect(window.location.href).toBe('https://pay.example/checkout');
    });
  });

  it('checkout unavailable shows Coming soon on paid plans', async () => {
    renderPage();
    const plansRegion = await screen.findByRole('region', { name: 'Plans' });
    const starterCard = cardForPlan(plansRegion, 'Starter');
    expect(starterCard.getByRole('button', { name: 'Coming soon' }).hasAttribute('disabled')).toBe(true);
  });

  it('checkout errors show friendly toast', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary(undefined, { checkoutAvailable: true }),
    });
    mockCreatePlanCheckoutSession.mockResolvedValue({
      ok: false,
      status: 503,
      error: 'Unavailable',
      errorCode: 'billing_provider_not_configured',
    });
    renderPage();
    const plans = within(await screen.findByRole('region', { name: 'Plans' }));
    fireEvent.click(
      within(plans.getByRole('heading', { name: 'Pro', level: 3 }).closest('article')!).getByRole('button', {
        name: 'Upgrade to Pro',
      }),
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Checkout is not configured yet.');
    });
  });

  it('add-on button calls top-up checkout endpoint for AI credits', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary(
        {
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          },
          entitlements: {
            ...mockTrialBillingEntitlements(),
            isTrialPlan: false,
            addonsAllowed: true,
            creditsRenewMonthly: true,
          },
        },
        { checkoutAvailable: true },
      ),
    });
    renderPage();
    const addons = within(await screen.findByRole('region', { name: 'Add-ons' }));
    fireEvent.click(addons.getByRole('button', { name: 'Buy add-on' }));
    await waitFor(() => {
      expect(mockCreateTopUpCheckoutSession).toHaveBeenCalledWith('ws-1', 'ai_credits_1000');
    });
  });

  it('updates paid plan prices when switching to annual billing', async () => {
    renderPage();
    const plans = within(await screen.findByRole('region', { name: 'Plans' }));
    expect(plans.getByText('$49')).toBeTruthy();
    expect(plans.getByText('$99')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Annually/i }));

    expect(screen.getByRole('tab', { name: /Annually/i }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() => {
      expect(plans.getByText('$39')).toBeTruthy();
      expect(plans.getByText('$79')).toBeTruthy();
    });
    expect(plans.getByText('per month, $470 billed annually')).toBeTruthy();
    expect(plans.getByText('per month, $950 billed annually')).toBeTruthy();
    expect(plans.getAllByText('Save 20%').length).toBe(2);
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
    expect(await screen.findByRole('region', { name: 'Plans' })).toBeTruthy();
  });

  it('shows loading skeleton while fetching', async () => {
    mockGetWorkspaceBillingSummary.mockImplementation(
      () => new Promise(() => {
        /* never resolves */
      }),
    );
    renderPage();
    expect(await screen.findByLabelText('Loading plans')).toBeTruthy();
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
