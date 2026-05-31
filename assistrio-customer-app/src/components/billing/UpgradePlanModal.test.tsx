import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  UpgradePlanModalProvider,
  useUpgradePlanModal,
} from '@/components/billing/UpgradePlanModalProvider';

vi.mock('@/hooks/useBillingCheckout', () => ({
  useBillingCheckout: () => ({
    startPlanCheckout: vi.fn(),
    startAddonCheckout: vi.fn(),
    startTopUpCheckout: vi.fn(),
    isPlanLoading: () => false,
    isAddonLoading: () => false,
  }),
}));

vi.mock('@/hooks/useBillingSubscriptionActions', () => ({
  useBillingSubscriptionActions: () => ({
    busy: false,
    changePlan: vi.fn(async () => true),
  }),
}));

vi.mock('@/hooks/useWorkspaceBillingSummary', () => ({
  buildWorkspaceBillingSessionKey: () => 'session',
  useWorkspaceBillingSummary: () => ({
    summary: {
      workspaceId: 'ws-1',
      plan: {
        key: 'free',
        name: 'Free',
        priceMonthly: 0,
        status: 'active',
        currentPeriodStart: '2026-05-01T00:00:00.000Z',
        currentPeriodEnd: '2026-06-01T00:00:00.000Z',
      },
      subscription: {
        subscriptionStatus: 'trialing',
        hasActivePaidSubscription: false,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '2026-06-01T00:00:00.000Z',
      },
      entitlements: {
        isTrialPlan: true,
        addonsAllowed: false,
        monthlyAiCredits: 50,
        botLimit: 1,
        memberLimit: 1,
        kbStorageMbPerBot: 5,
        canExportReports: false,
        analyticsHistoryDays: 7,
      },
      usage: {
        bots: { current: 1, limit: 1 },
        members: { current: 1, pendingInvites: 0, used: 1, limit: 1 },
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
        trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: '' },
      },
      planCatalog: [
        {
          key: 'free',
          name: 'Free',
          priceMonthly: 0,
          botLimit: 1,
          memberLimit: 1,
          monthlyAiCredits: 50,
          kbStorageMbPerBot: 5,
          analyticsHistoryDays: 7,
          canExportReports: false,
          checkoutAvailable: true,
        },
        {
          key: 'starter',
          name: 'Starter',
          priceMonthly: 49,
          botLimit: 1,
          memberLimit: 5,
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
          botLimit: 1,
          memberLimit: 10,
          monthlyAiCredits: 2000,
          kbStorageMbPerBot: 30,
          analyticsHistoryDays: null,
          canExportReports: true,
          checkoutAvailable: true,
        },
      ],
      addonCatalog: [],
      activeAddons: [],
    },
    reload: vi.fn(),
  }),
}));

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: {
      id: 'cust-1',
      workspaceIds: ['ws-1'],
      workspaces: [{ id: 'ws-1', role: 'owner' }],
    },
  }),
}));

function OpenUpgradeButton() {
  const { openUpgradeModal } = useUpgradePlanModal();
  return (
    <button type="button" onClick={() => openUpgradeModal({ reason: 'members', mode: 'upgrade' })}>
      Open upgrade
    </button>
  );
}

describe('UpgradePlanModalProvider', () => {
  afterEach(() => cleanup());

  it('opens contextual upgrade modal for free users with Starter only', async () => {
    render(
      <UpgradePlanModalProvider>
        <OpenUpgradeButton />
      </UpgradePlanModalProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open upgrade' }));

    expect(await screen.findByRole('heading', { name: 'Upgrade plan', level: 2 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Starter', level: 3 })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pro', level: 3 })).toBeNull();
  });
});
