import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import type { WorkspaceBillingSummary } from '@/api/types';
import { BillingCheckoutReturnBanner } from '@/pages/billing/BillingCheckoutReturnBanner';

function buildSummary(): WorkspaceBillingSummary {
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
      bots: { current: 0, limit: 1 },
      members: { current: 0, pendingInvites: 0, used: 0, limit: 1 },
      aiCredits: {
        periodStart: '',
        periodEnd: '',
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
    planCatalog: [],
    addonCatalog: [],
    activeAddons: [],
  };
}

describe('BillingCheckoutReturnBanner', () => {
  it('shows confirming payment on success return', () => {
    render(
      <MemoryRouter initialEntries={['/settings/billing?checkout=success']}>
        <BillingCheckoutReturnBanner
          summary={buildSummary()}
          onRefreshBilling={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Checkout completed. We're confirming your payment.")).toBeTruthy();
    expect(screen.getByRole('button', { name: /Refresh billing status/i })).toBeTruthy();
  });

  it('shows cancelled message', () => {
    render(
      <MemoryRouter initialEntries={['/settings/billing?checkout=cancelled']}>
        <BillingCheckoutReturnBanner summary={buildSummary()} onRefreshBilling={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Checkout was cancelled.')).toBeTruthy();
  });
});
