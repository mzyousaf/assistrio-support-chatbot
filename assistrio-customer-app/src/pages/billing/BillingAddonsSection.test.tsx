import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import { BillingAddonsSection } from './BillingAddonsSection';

const mockCreateAddonCheckoutSession = vi.fn();
const mockCreateTopUpCheckoutSession = vi.fn();
const mockCreateBillingManageSession = vi.fn();
const mockPatchWorkspaceCreditAutoTopUp = vi.fn();

const mockCreateAutoTopUpCheckoutSession = vi.fn();
const mockDisableWorkspaceAutoTopUp = vi.fn();

vi.mock('@/api/customerApi', () => ({
  createAddonCheckoutSession: (...args: unknown[]) => mockCreateAddonCheckoutSession(...args),
  createTopUpCheckoutSession: (...args: unknown[]) => mockCreateTopUpCheckoutSession(...args),
  createBillingManageSession: (...args: unknown[]) => mockCreateBillingManageSession(...args),
  cancelWorkspaceAddon: vi.fn(),
  patchWorkspaceCreditAutoTopUp: (...args: unknown[]) => mockPatchWorkspaceCreditAutoTopUp(...args),
  createAutoTopUpCheckoutSession: (...args: unknown[]) => mockCreateAutoTopUpCheckoutSession(...args),
  disableWorkspaceAutoTopUp: (...args: unknown[]) => mockDisableWorkspaceAutoTopUp(...args),
}));

vi.mock('@/lib/app-toast', () => ({
  appToast: { error: vi.fn(), success: vi.fn() },
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
      key: 'starter',
      name: 'Starter',
      priceMonthly: 49,
      status: 'active',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    },
    subscription: mockBillingSubscription({ hasActivePaidSubscription: true }),
    entitlements: {
      ...mockTrialBillingEntitlements(),
      isTrialPlan: false,
      addonsAllowed: true,
    },
    usage: {
      bots: { current: 1, limit: 1 },
      members: { current: 1, pendingInvites: 0, used: 1, limit: 3 },
      aiCredits: {
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
        monthlyCredits: 500,
        monthlyCreditsUsed: 0,
        monthlyCreditsRemaining: 500,
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: 500,
        totalCreditsRemaining: 500,
        isOverLimit: false,
        byBot: [],
      },
      trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: '' },
    },
    planCatalog: [],
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

describe('BillingAddonsSection', () => {
  beforeEach(() => {
    mockCreateBillingManageSession.mockResolvedValue({
      ok: true,
      data: { url: 'https://portal.lemonsqueezy.com/billing', provider: 'lemon_squeezy' },
    });
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders add-ons with inactive status and purchase actions', async () => {
    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary()}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Add-ons' })).toBeTruthy();
    expect(screen.getByText('Extra AI Agent')).toBeTruthy();
    expect(screen.getAllByText('Not active').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Buy add-on: Extra AI Agent' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buy add-on: 1,000 extra AI credits' })).toBeTruthy();
  });

  it('shows active badge and cancel for active recurring add-on', async () => {
    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            addonCatalog: [
              {
                key: 'remove_branding',
                name: 'Remove branding',
                billingInterval: 'monthly',
                priceUsd: 20,
                scope: 'workspace',
                checkoutAvailable: true,
                status: 'active',
                currentPeriodEnd: '2026-07-01T00:00:00.000Z',
                description: 'Hide powered by branding.',
              },
            ],
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Active')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel add-on' })).toBeTruthy();
    expect(screen.getByTestId('billing-addon-icon-remove_branding').getAttribute('data-added')).toBe('true');
  });

  it('shows extra bot active count and per-instance cancel buttons', async () => {
    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            extraBotAddons: [
              {
                id: 'extra-bot-1',
                addonKey: 'extra_bot',
                name: 'Extra bot',
                status: 'active',
                cancelAtPeriodEnd: false,
                currentPeriodEnd: '2026-06-30T00:00:00.000Z',
                priceUsd: 49,
                effectLabel: '+1 agent',
              },
              {
                id: 'extra-bot-2',
                addonKey: 'extra_bot',
                name: 'Extra bot',
                status: 'cancel_at_period_end',
                cancelAtPeriodEnd: true,
                currentPeriodEnd: '2026-06-30T00:00:00.000Z',
                priceUsd: 49,
                effectLabel: '+1 agent',
              },
            ],
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText('2 active add-ons')).toBeTruthy();
    expect(screen.getByText(/Adds 2 extra AI Agents to this workspace/i)).toBeTruthy();
    expect(screen.getByText(/Extra AI Agent #1/i)).toBeTruthy();
    expect(screen.getByText(/Extra AI Agent #2/i)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Cancel add-on' })).toHaveLength(1);
    expect(screen.getByTestId('billing-addon-icon-extra_bot').getAttribute('data-added')).toBe('true');
  });

  it('passes yearly billing interval to add-on checkout when annual is selected', async () => {
    mockCreateAddonCheckoutSession.mockResolvedValue({
      ok: true,
      data: { checkoutUrl: 'https://checkout.example/addon', provider: 'lemon_squeezy' },
    });

    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            addonCatalog: [
              {
                key: 'remove_branding',
                name: 'Remove branding',
                billingInterval: 'monthly',
                priceUsd: 29,
                priceYearly: 313.2,
                monthlyEquivalentYearly: 26.1,
                yearlyDiscountPercent: 10,
                scope: 'workspace',
                checkoutAvailable: true,
                checkoutAvailableMonthly: true,
                checkoutAvailableYearly: true,
                status: 'inactive',
                description: 'Hide branding.',
              },
            ],
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: /Annually/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Buy add-on: Remove branding' }));

    expect(mockCreateAddonCheckoutSession).toHaveBeenCalledWith('ws-1', 'remove_branding', undefined, 'yearly');
  });

  it('shows monthly/annual toggle with annual add-on pricing', async () => {
    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            addonCatalog: [
              {
                key: 'remove_branding',
                name: 'Remove branding',
                billingInterval: 'monthly',
                priceUsd: 29,
                priceYearly: 313.2,
                monthlyEquivalentYearly: 26.1,
                yearlyDiscountPercent: 10,
                scope: 'workspace',
                checkoutAvailable: true,
                checkoutAvailableMonthly: true,
                checkoutAvailableYearly: true,
                status: 'inactive',
                description: 'Hide branding.',
              },
            ],
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('tab', { name: /Annually/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Annually/i }));
    expect(screen.getByText('Save 10%')).toBeTruthy();
    expect(screen.getByText(/\/ month, \$313 billed annually/i)).toBeTruthy();
  });

  it('shows annual unavailable message when yearly checkout is not configured', async () => {
    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            addonCatalog: [
              {
                key: 'remove_branding',
                name: 'Remove branding',
                billingInterval: 'monthly',
                priceUsd: 29,
                scope: 'workspace',
                checkoutAvailable: true,
                checkoutAvailableMonthly: true,
                checkoutAvailableYearly: false,
                status: 'inactive',
                description: 'Hide branding.',
              },
            ],
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Annual billing is not available yet')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Annually/i }).getAttribute('disabled')).not.toBeNull();
  });

  it('merges multiple top-up purchases into one balance bar', async () => {
    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            usage: {
              ...buildSummary().usage,
              aiCredits: {
                ...buildSummary().usage.aiCredits,
                topUpCreditsRemaining: 1700,
                totalCreditsRemaining: 2200,
              },
            },
            topUps: [
              {
                creditsPurchased: 1000,
                creditsRemaining: 800,
                expiresAt: '2027-05-01T00:00:00.000Z',
                createdAt: '2026-05-01T00:00:00.000Z',
              },
              {
                creditsPurchased: 1000,
                creditsRemaining: 900,
                expiresAt: '2027-06-01T00:00:00.000Z',
                createdAt: '2026-05-02T00:00:00.000Z',
              },
            ],
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('progressbar', { name: '300 of 2,000 extra AI credits used' })).toBeTruthy();
    expect(screen.getAllByText('Extra AI Credits Used')).toHaveLength(1);
  });

  it('shows available on paid plans callout on free trial', async () => {
    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            plan: {
              key: 'free',
              name: 'Free',
              priceMonthly: 0,
              status: 'free',
              currentPeriodStart: '2026-05-01T00:00:00.000Z',
              currentPeriodEnd: '2026-06-01T00:00:00.000Z',
            },
            entitlements: {
              ...mockTrialBillingEntitlements(),
              isTrialPlan: true,
              addonsAllowed: false,
            },
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText(/Add-ons are available on paid plans/i)).length).toBeGreaterThan(0);
  });

  it('shows Payment issue badge for past_due recurring add-on', async () => {
    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            subscription: mockBillingSubscription({
              hasActivePaidSubscription: true,
              manageBillingAvailable: true,
              customerPortalAvailable: true,
            }),
            addonCatalog: [
              {
                key: 'remove_branding',
                name: 'Remove branding',
                billingInterval: 'monthly',
                priceUsd: 20,
                scope: 'workspace',
                checkoutAvailable: true,
                status: 'past_due',
                currentPeriodEnd: '2026-07-01T00:00:00.000Z',
                description: 'Hide powered by branding.',
              },
            ],
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Payment issue')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage in Lemon Squeezy' })).toBeTruthy();
    expect(screen.queryByText('Active')).toBeNull();
  });

  it('shows auto top-up toggle on 1,000 extra AI credits card', async () => {
    mockPatchWorkspaceCreditAutoTopUp.mockResolvedValue({
      ok: true,
      autoTopUpPromptEnabled: true,
      summary: buildSummary(),
    });

    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            addonCatalog: [
              {
                key: 'ai_credits_1000',
                name: '1,000 extra AI credits',
                billingInterval: 'one_time',
                priceUsd: 30,
                scope: 'workspace',
                checkoutAvailable: true,
                status: 'inactive',
                autoTopUpPromptEnabled: false,
                description: 'One-time credit pack.',
              },
            ],
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    const toggle = await screen.findByRole('switch', { name: 'Reminder for top-up' });
    expect(toggle).toBeTruthy();
    expect((toggle as HTMLButtonElement).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/does not charge your card automatically/i)).toBeTruthy();

    fireEvent.click(toggle);
    expect(mockPatchWorkspaceCreditAutoTopUp).toHaveBeenCalledWith('ws-1', true);
  });

  it('opens enable auto top-up confirmation and starts Lemon checkout', async () => {
    mockCreateAutoTopUpCheckoutSession.mockResolvedValue({
      ok: true,
      data: { checkoutUrl: 'https://checkout.lemonsqueezy.com/auto-topup' },
    });
    let assignedHref = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        set href(value: string) {
          assignedHref = value;
        },
        get href() {
          return assignedHref;
        },
      },
    });

    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            addonCatalog: [
              {
                key: 'ai_credits_1000',
                name: '1,000 extra AI credits',
                billingInterval: 'one_time',
                priceUsd: 30,
                scope: 'workspace',
                checkoutAvailable: true,
                status: 'inactive',
                description: 'One-time credit pack.',
              },
            ],
            autoTopUp: {
              status: 'off',
              enabled: false,
              checkoutAvailable: true,
              cancelAtPeriodEnd: false,
              currentPeriodEnd: null,
              packsThisBillingPeriod: 0,
              maxPacksPerBillingPeriod: 5,
              packCredits: 1000,
              packPriceUsd: 30,
            },
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Enable auto top-up' }));
    expect(await screen.findByRole('heading', { name: 'Enable auto top-up?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Lemon Squeezy' }));

    await vi.waitFor(() => {
      expect(mockCreateAutoTopUpCheckoutSession).toHaveBeenCalledWith('ws-1');
      expect(assignedHref).toBe('https://checkout.lemonsqueezy.com/auto-topup');
    });
  });

  it('shows active auto top-up status and usage order copy', async () => {
    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            addonCatalog: [
              {
                key: 'ai_credits_1000',
                name: '1,000 extra AI credits',
                billingInterval: 'one_time',
                priceUsd: 30,
                scope: 'workspace',
                checkoutAvailable: true,
                status: 'inactive',
                description: 'One-time credit pack.',
              },
            ],
            autoTopUp: {
              status: 'active',
              enabled: true,
              checkoutAvailable: true,
              cancelAtPeriodEnd: false,
              currentPeriodEnd: '2026-06-01T00:00:00.000Z',
              packsThisBillingPeriod: 1,
              maxPacksPerBillingPeriod: 5,
              packCredits: 1000,
              packPriceUsd: 30,
            },
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Status: Active')).toBeTruthy();
    expect(
      screen.getByText(
        /Monthly credits are used first\. Existing top-up credits are used second\. Auto top-up runs only when both are exhausted\./,
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buy add-on: 1,000 extra AI credits' })).toBeTruthy();
  });

  it('shows payment issue auto top-up status', async () => {
    render(
      <MemoryRouter>
        <BillingAddonsSection
          workspaceId="ws-1"
          role="owner"
          summary={buildSummary({
            addonCatalog: [
              {
                key: 'ai_credits_1000',
                name: '1,000 extra AI credits',
                billingInterval: 'one_time',
                priceUsd: 30,
                scope: 'workspace',
                checkoutAvailable: true,
                status: 'inactive',
                description: 'One-time credit pack.',
              },
            ],
            autoTopUp: {
              status: 'payment_issue',
              enabled: true,
              checkoutAvailable: true,
              cancelAtPeriodEnd: false,
              currentPeriodEnd: null,
              packsThisBillingPeriod: 0,
              maxPacksPerBillingPeriod: 5,
              packCredits: 1000,
              packPriceUsd: 30,
            },
          })}
          checkoutEnabled
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Status: Payment issue')).toBeTruthy();
  });
});
