import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import { BillingAddonsSection } from './BillingAddonsSection';

const mockCreateAddonCheckoutSession = vi.fn();
const mockCreateTopUpCheckoutSession = vi.fn();

vi.mock('@/api/customerApi', () => ({
  createAddonCheckoutSession: (...args: unknown[]) => mockCreateAddonCheckoutSession(...args),
  createTopUpCheckoutSession: (...args: unknown[]) => mockCreateTopUpCheckoutSession(...args),
  cancelWorkspaceAddon: vi.fn(),
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
    expect(screen.getByText('Extra agent')).toBeTruthy();
    expect(screen.getAllByText('Not active').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Add add-on' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buy credits' })).toBeTruthy();
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

    expect(await screen.findByText(/Add-ons are available on paid plans/i)).toBeTruthy();
  });
});
