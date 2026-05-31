import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import { BillingTrialAlerts } from '@/pages/billing/BillingTrialAlerts';

function buildSummary(overrides?: Partial<WorkspaceBillingSummary>): WorkspaceBillingSummary {
  return {
    workspaceId: 'ws-1',
    plan: {
      key: 'free',
      name: 'Free',
      priceMonthly: 0,
      status: 'trialing',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    },
    subscription: mockBillingSubscription({
      currentPeriodEnd: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    }),
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

describe('BillingTrialAlerts', () => {
  afterEach(() => cleanup());

  function renderAlerts(summary: ReturnType<typeof buildSummary>) {
    render(
      <MemoryRouter>
        <BillingTrialAlerts summary={summary} />
      </MemoryRouter>,
    );
  }

  it('shows ending soon banner', () => {
    renderAlerts(buildSummary());

    expect(screen.getByText(/Your trial ends soon/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View plans' })).toBeTruthy();
  });

  it('shows expired trial banner', () => {
    const summary = buildSummary({
      entitlements: {
        ...mockTrialBillingEntitlements(),
        isTrialExpired: true,
      },
    });

    renderAlerts(summary);

    expect(screen.getByText(/Your free trial has ended/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Upgrade' })).toBeTruthy();
  });

  it('shows credits used banner', () => {
    const summary = buildSummary({
      usage: {
        ...buildSummary().usage,
        aiCredits: {
          ...buildSummary().usage.aiCredits,
          monthlyCreditsUsed: 50,
          monthlyCreditsRemaining: 0,
          isOverLimit: true,
        },
      },
    });

    renderAlerts(summary);

    expect(screen.getByText(/You've used all 50 trial credits/i)).toBeTruthy();
  });
});
