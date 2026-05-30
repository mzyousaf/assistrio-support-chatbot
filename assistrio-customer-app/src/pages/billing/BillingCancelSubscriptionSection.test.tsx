import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import { BillingCancelSubscriptionSection } from './BillingCancelSubscriptionSection';

const mockCreateBillingManageSession = vi.fn();
const mockChangeWorkspaceSubscriptionPlan = vi.fn();

vi.mock('@/api/customerApi', () => ({
  createBillingManageSession: (...args: unknown[]) => mockCreateBillingManageSession(...args),
  changeWorkspaceSubscriptionPlan: (...args: unknown[]) => mockChangeWorkspaceSubscriptionPlan(...args),
  restoreWorkspaceSubscription: vi.fn(),
}));

vi.mock('@/lib/app-toast', () => ({
  appToast: { error: vi.fn(), success: vi.fn() },
}));

function buildSummary(planKey: 'starter' | 'pro' = 'starter'): WorkspaceBillingSummary {
  return {
    workspaceId: 'ws-1',
    plan: {
      key: planKey,
      name: planKey === 'pro' ? 'Pro' : 'Starter',
      priceMonthly: planKey === 'pro' ? 99 : 49,
      status: 'active',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-07-01T00:00:00.000Z',
    },
    subscription: mockBillingSubscription({
      subscriptionStatus: 'active',
      hasActivePaidSubscription: true,
      manageBillingAvailable: true,
      customerPortalAvailable: true,
      currentPeriodEnd: '2026-07-01T00:00:00.000Z',
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
  };
}

function renderSection(planKey: 'starter' | 'pro' = 'starter') {
  return render(
    <BillingCancelSubscriptionSection
      workspaceId="ws-1"
      role="owner"
      summary={buildSummary(planKey)}
      checkoutEnabled
      onSummaryUpdated={vi.fn()}
    />,
  );
}

describe('BillingCancelSubscriptionSection', () => {
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

  it('opens Before you cancel modal and does not call cancel API', async () => {
    renderSection('starter');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    expect(await screen.findByRole('heading', { name: 'Before you cancel' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Downgrade to Starter' })).toBeNull();
    expect(mockCreateBillingManageSession).not.toHaveBeenCalled();
  });

  it('Starter modal shows Continue to Lemon Squeezy only', async () => {
    renderSection('starter');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    expect(await screen.findByRole('button', { name: 'Continue to Lemon Squeezy' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Downgrade to Starter' })).toBeNull();
  });

  it('Pro modal shows Downgrade to Starter and Continue to Lemon Squeezy', async () => {
    renderSection('pro');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    expect(await screen.findByRole('button', { name: 'Downgrade to Starter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue to Lemon Squeezy' })).toBeTruthy();
  });

  it('Continue to Lemon Squeezy opens portal in a new tab', async () => {
    const openMock = vi.mocked(window.open);
    renderSection('starter');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue to Lemon Squeezy' }));
    await waitFor(() => {
      expect(mockCreateBillingManageSession).toHaveBeenCalledWith('ws-1');
      expect(openMock).toHaveBeenCalledWith(
        'https://portal.lemonsqueezy.com/billing',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });
});
