import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import { PlansModal } from './PlansModal';

const checkout = {
  startPlanCheckout: vi.fn(),
  startAddonCheckout: vi.fn(),
  startTopUpCheckout: vi.fn(),
  isPlanLoading: () => false,
  isAddonLoading: () => false,
};

function buildSummary(): WorkspaceBillingSummary {
  return {
    workspaceId: 'ws-1',
    plan: {
      key: 'free',
      name: 'Free',
      priceMonthly: 0,
      status: 'active',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    },
    subscription: mockBillingSubscription({ hasActivePaidSubscription: false }),
    entitlements: mockTrialBillingEntitlements(),
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
  };
}

describe('PlansModal', () => {
  afterEach(() => cleanup());

  it('renders plan cards with includes when open', () => {
    render(
      <PlansModal
        open
        onClose={vi.fn()}
        summary={buildSummary()}
        workspaceId="ws-1"
        role="owner"
        isOwner
        checkout={checkout}
        mode="upgrade"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Upgrade plan', level: 2 })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Billing period' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Plans' })).toBeTruthy();
    expect(screen.getAllByText('Core limits').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'What each plan includes' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Why Free?', level: 4 })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Why Starter?', level: 4 })).toBeNull();
  });

  it('shows current plan corner tag and days left on the free trial card', () => {
    render(
      <PlansModal
        open
        onClose={vi.fn()}
        summary={buildSummary()}
        workspaceId="ws-1"
        role="owner"
        isOwner
        checkout={checkout}
        mode="billing"
      />,
    );

    const freeHeading = screen.getByRole('heading', { name: '7-day free trial', level: 3 });
    const freeArticle = freeHeading.closest('article');
    expect(freeArticle).toBeTruthy();
    expect(freeArticle?.getAttribute('aria-current')).toBe('true');

    const freeCard = within(freeArticle!);
    expect(freeCard.getByText('Current plan')).toBeTruthy();
    expect(freeCard.getByRole('button', { name: /Day Left$/ })).toBeTruthy();
    expect(freeCard.queryByText('Best value for small businesses')).toBeNull();
  });

  it('upgrade mode on Starter shows Pro only with plan change action', () => {
    const summary = buildSummary();
    summary.plan = {
      key: 'starter',
      name: 'Starter',
      priceMonthly: 49,
      status: 'active',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    };
    summary.entitlements = { ...summary.entitlements, isTrialPlan: false };
    const onUpgradeToPro = vi.fn();

    render(
      <PlansModal
        open
        onClose={vi.fn()}
        summary={summary}
        workspaceId="ws-1"
        role="owner"
        isOwner
        checkout={checkout}
        mode="upgrade"
        onUpgradeToPro={onUpgradeToPro}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Pro', level: 3 })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));
    expect(onUpgradeToPro).toHaveBeenCalled();
    expect(checkout.startPlanCheckout).not.toHaveBeenCalled();
  });

  it('upgrade mode on Pro shows highest plan panel', () => {
    const summary = buildSummary();
    summary.plan = {
      key: 'pro',
      name: 'Pro',
      priceMonthly: 99,
      status: 'active',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-06-01T00:00:00.000Z',
    };
    summary.entitlements = { ...summary.entitlements, isTrialPlan: false };

    render(
      <PlansModal
        open
        onClose={vi.fn()}
        summary={summary}
        workspaceId="ws-1"
        role="owner"
        isOwner
        checkout={checkout}
        mode="upgrade"
        upgradeReason="bots"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Highest plan', level: 2 })).toBeTruthy();
    expect(screen.getByText("You're on the highest plan")).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Plans' })).toBeNull();
  });

});
