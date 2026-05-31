import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import { BillingSubscriptionOverviewSection } from './BillingSubscriptionOverviewSection';

const mockCreateBillingManageSession = vi.fn();

const mockChangeWorkspaceSubscriptionPlan = vi.fn();

vi.mock('@/api/customerApi', () => ({
  createBillingManageSession: (...args: unknown[]) => mockCreateBillingManageSession(...args),
  createPlanCheckoutSession: vi.fn(),
  changeWorkspaceSubscriptionPlan: (...args: unknown[]) => mockChangeWorkspaceSubscriptionPlan(...args),
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
    subscription: mockBillingSubscription({
      subscriptionStatus: 'active',
      hasActivePaidSubscription: true,
      manageBillingAvailable: true,
      customerPortalAvailable: true,
    }),
    entitlements: { ...mockTrialBillingEntitlements(), isTrialPlan: false },
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
    addonCatalog: [],
    activeAddons: [],
    topUps: [],
    ...overrides,
  };
}

describe('BillingSubscriptionOverviewSection', () => {
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

  it('shows Payment issue badge and Manage button for past_due plan', async () => {
    render(
      <BillingSubscriptionOverviewSection
        workspaceId="ws-1"
        role="owner"
        checkoutEnabled
        summary={buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'past_due',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          },
          subscription: mockBillingSubscription({
            subscriptionStatus: 'past_due',
            hasActivePaidSubscription: true,
            hasPaymentIssue: true,
            manageBillingAvailable: true,
            customerPortalAvailable: true,
          }),
        })}
      />,
    );

    const currentPlan = await screen.findByTestId('billing-current-plan');
    expect(within(currentPlan).getByText('Payment issue')).toBeTruthy();
    expect(
      within(currentPlan).getByText(/Please update your payment method to avoid losing access/i),
    ).toBeTruthy();
    expect(within(currentPlan).getByRole('button', { name: 'Manage in Lemon Squeezy' })).toBeTruthy();
    expect(within(currentPlan).queryByText('Active')).toBeNull();
  });

  it('does not show payment issue warning for active plan', async () => {
    render(
      <BillingSubscriptionOverviewSection
        workspaceId="ws-1"
        role="owner"
        checkoutEnabled
        summary={buildSummary()}
      />,
    );

    const currentPlan = await screen.findByTestId('billing-current-plan');
    expect(within(currentPlan).getByText('Active')).toBeTruthy();
    expect(within(currentPlan).queryByText('Payment issue')).toBeNull();
    expect(within(currentPlan).queryByRole('button', { name: 'Manage in Lemon Squeezy' })).toBeNull();
  });

  it('opens Lemon portal from Manage in Lemon Squeezy', async () => {
    const openMock = vi.mocked(window.open);
    render(
      <BillingSubscriptionOverviewSection
        workspaceId="ws-1"
        role="owner"
        checkoutEnabled
        summary={buildSummary({
          subscription: mockBillingSubscription({
            subscriptionStatus: 'past_due',
            hasActivePaidSubscription: true,
            hasPaymentIssue: true,
            manageBillingAvailable: true,
            customerPortalAvailable: true,
          }),
        })}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Manage in Lemon Squeezy' }));
    await waitFor(() => {
      expect(mockCreateBillingManageSession).toHaveBeenCalledWith('ws-1');
      expect(openMock).toHaveBeenCalledWith(
        'https://portal.lemonsqueezy.com/billing',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });

  it('opens upgrade modal for paid Starter instead of checkout', async () => {
    mockChangeWorkspaceSubscriptionPlan.mockResolvedValue({
      ok: true,
      data: { message: 'Upgraded', summary: buildSummary({ plan: { key: 'pro', name: 'Pro', priceMonthly: 99, status: 'active', currentPeriodStart: '2026-05-01T00:00:00.000Z', currentPeriodEnd: '2026-06-01T00:00:00.000Z' } }) },
    });

    render(
      <BillingSubscriptionOverviewSection
        workspaceId="ws-1"
        role="owner"
        checkoutEnabled
        summary={buildSummary({
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
            {
              key: 'pro',
              name: 'Pro',
              priceMonthly: 99,
              botLimit: 10,
              memberLimit: 10,
              monthlyAiCredits: 2000,
              kbStorageMbPerBot: 30,
              analyticsHistoryDays: null,
              canExportReports: true,
              checkoutAvailable: true,
            },
          ],
        })}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Upgrade to Pro' }));
    expect(await screen.findByRole('heading', { name: 'Upgrade to Pro?' })).toBeTruthy();
    expect(
      screen.getByText(/Lemon Squeezy will calculate any prorated charge automatically/i),
    ).toBeTruthy();
  });
});
