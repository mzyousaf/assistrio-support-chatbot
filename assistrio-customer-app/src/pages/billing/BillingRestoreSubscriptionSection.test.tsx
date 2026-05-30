import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import { BillingRestoreSubscriptionSection } from './BillingRestoreSubscriptionSection';

const mockRestoreWorkspaceSubscription = vi.fn();

vi.mock('@/api/customerApi', () => ({
  restoreWorkspaceSubscription: (...args: unknown[]) => mockRestoreWorkspaceSubscription(...args),
  changeWorkspaceSubscriptionPlan: vi.fn(),
}));

vi.mock('@/lib/app-toast', () => ({
  appToast: { error: vi.fn(), success: vi.fn() },
}));

function buildSummary(): WorkspaceBillingSummary {
  return {
    workspaceId: 'ws-1',
    plan: {
      key: 'starter',
      name: 'Starter',
      priceMonthly: 49,
      status: 'active',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-12-01T00:00:00.000Z',
    },
    subscription: mockBillingSubscription({
      subscriptionStatus: 'active',
      hasActivePaidSubscription: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: '2026-12-01T00:00:00.000Z',
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

describe('BillingRestoreSubscriptionSection', () => {
  beforeEach(() => {
    mockRestoreWorkspaceSubscription.mockResolvedValue({
      ok: true,
      data: { message: 'Subscription restored.', summary: buildSummary() },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows restore banner and calls restore API', async () => {
    const onSummaryUpdated = vi.fn();
    render(
      <BillingRestoreSubscriptionSection
        workspaceId="ws-1"
        role="owner"
        summary={buildSummary()}
        checkoutEnabled
        onSummaryUpdated={onSummaryUpdated}
      />,
    );

    expect(screen.getByText(/scheduled to cancel on/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore subscription' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Restore subscription?' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore subscription' }));

    await waitFor(() => {
      expect(mockRestoreWorkspaceSubscription).toHaveBeenCalledWith('ws-1');
    });
  });
});
