import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ComponentProps } from 'react';
import type { WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import { AppShellCreditsWidget } from '@/layout/AppShellCreditsWidget';
import { APP_SHELL_CREDITS_WIDGET_COLLAPSE_STORAGE_KEY } from '@/layout/appShellCreditsWidgetCollapse';

function buildBillingSummary(
  overrides?: Partial<WorkspaceBillingSummary>,
): WorkspaceBillingSummary {
  return {
    workspaceId: 'ws-1',
    plan: {
      key: 'starter',
      name: 'Starter',
      priceMonthly: 49,
      status: 'active',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-06-29T00:00:00.000Z',
    },
    subscription: mockBillingSubscription({
      subscriptionStatus: 'active',
      hasActivePaidSubscription: true,
    }),
    entitlements: { ...mockTrialBillingEntitlements(), isTrialPlan: false },
    usage: {
      bots: { current: 1, limit: 1 },
      members: { current: 1, pendingInvites: 0, used: 1, limit: 3 },
      aiCredits: {
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-29T00:00:00.000Z',
        monthlyCredits: 500,
        monthlyCreditsUsed: 12,
        monthlyCreditsRemaining: 488,
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: 500,
        totalCreditsRemaining: 488,
        isOverLimit: false,
        byBot: [],
      },
      trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: '' },
    },
    planCatalog: [
      {
        key: 'starter',
        name: 'Starter',
        priceMonthly: 49,
        botLimit: 3,
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
        botLimit: 10,
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
    topUps: [],
    ...overrides,
  };
}

function renderWidget(
  props: Partial<ComponentProps<typeof AppShellCreditsWidget>> = {},
) {
  return render(
    <MemoryRouter>
      <AppShellCreditsWidget
        variant="card"
        activeWorkspaceId="ws-1"
        loadState="ready"
        aiCredits={{
          periodStart: '',
          periodEnd: '',
          monthlyCredits: 50,
          monthlyCreditsUsed: 12,
          monthlyCreditsRemaining: 38,
          topUpCreditsRemaining: 0,
          totalCreditsAvailable: 50,
          totalCreditsRemaining: 38,
          isOverLimit: false,
          byBot: [],
        }}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('AppShellCreditsWidget', () => {
  beforeEach(() => {
    window.localStorage.removeItem(APP_SHELL_CREDITS_WIDGET_COLLAPSE_STORAGE_KEY);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.removeItem(APP_SHELL_CREDITS_WIDGET_COLLAPSE_STORAGE_KEY);
  });

  it('renders AI credits header with monthly bar usage', () => {
    renderWidget();
    expect(screen.getByText('AI credits')).toBeTruthy();
    expect(screen.getByText('Monthly AI credits')).toBeTruthy();
    expect(screen.getByText('12 / 50')).toBeTruthy();
    expect(screen.getByLabelText('Monthly AI credits used this billing period')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWidget({ loadState: 'loading', aiCredits: undefined });
    expect(screen.getByLabelText('Loading credits')).toBeTruthy();
    expect(screen.getByText('AI credits')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWidget({ loadState: 'error', aiCredits: undefined });
    expect(screen.getByText('Usage unavailable')).toBeTruthy();
  });

  it('hides widget when there is no active workspace', () => {
    const { container } = renderWidget({ activeWorkspaceId: null });
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows over-limit warning state', () => {
    renderWidget({
      aiCredits: {
        periodStart: '',
        periodEnd: '',
        monthlyCredits: 50,
        monthlyCreditsUsed: 55,
        monthlyCreditsRemaining: 0,
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: 50,
        totalCreditsRemaining: 0,
        isOverLimit: true,
        byBot: [],
      },
    });
    expect(screen.getByText('55 / 50')).toBeTruthy();
    expect(screen.getByText('Over monthly limit')).toBeTruthy();
  });

  it('shows top-up credits bar when purchased top-up credits exist', () => {
    renderWidget({
      aiCredits: {
        periodStart: '',
        periodEnd: '',
        monthlyCredits: 500,
        monthlyCreditsUsed: 12,
        monthlyCreditsRemaining: 488,
        topUpCreditsRemaining: 1000,
        totalCreditsAvailable: 1500,
        totalCreditsRemaining: 1488,
        isOverLimit: false,
        byBot: [],
      },
      topUps: [
        {
          creditsPurchased: 1000,
          creditsRemaining: 1000,
          expiresAt: '2027-05-29T00:00:00.000Z',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    expect(screen.getByText('Top-up credits')).toBeTruthy();
    expect(screen.getByText('0 / 1,000')).toBeTruthy();
    expect(screen.getByLabelText('Top-up credits used')).toBeTruthy();
  });

  it('hides top-up bar when remaining credits have no purchase records', () => {
    renderWidget({
      aiCredits: {
        periodStart: '',
        periodEnd: '',
        monthlyCredits: 500,
        monthlyCreditsUsed: 12,
        monthlyCreditsRemaining: 488,
        topUpCreditsRemaining: 1000,
        totalCreditsAvailable: 1500,
        totalCreditsRemaining: 1488,
        isOverLimit: false,
        byBot: [],
      },
      topUps: [],
    });
    expect(screen.queryByText('Top-up credits')).toBeNull();
  });

  it('shows upgrade footer with plan comparison when a contextual upgrade exists', () => {
    renderWidget({
      billingSummary: buildBillingSummary({
        plan: {
          key: 'starter',
          name: 'Starter',
          priceMonthly: 49,
          status: 'active',
          currentPeriodStart: '2026-05-01T00:00:00.000Z',
          currentPeriodEnd: '2026-06-29T00:00:00.000Z',
        },
      }),
    });
    expect(screen.getByText('Upgrade Available')).toBeTruthy();
    expect(screen.getByText('STARTER')).toBeTruthy();
    expect(screen.getByText('PRO')).toBeTruthy();
    const comparison = within(screen.getByLabelText('Plan upgrade comparison'));
    expect(comparison.getByText('AI credits')).toBeTruthy();
    expect(comparison.getByText('KB storage')).toBeTruthy();
    expect(comparison.getByText('500')).toBeTruthy();
    expect(comparison.getByText('2,000')).toBeTruthy();
    expect(comparison.getByText('15 MB')).toBeTruthy();
    expect(comparison.getByText('30 MB')).toBeTruthy();
    expect(comparison.getByText('Members')).toBeTruthy();
    expect(comparison.getByText('10')).toBeTruthy();
    expect(comparison.getByText('Support')).toBeTruthy();
    expect(comparison.getByText('Priority')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Upgrade' })).toBeTruthy();
    expect(screen.queryByText('Current plan')).toBeNull();
  });

  it('shows free trial footer metadata for trial workspaces', () => {
    renderWidget({
      billingSummary: buildBillingSummary({
        plan: {
          key: 'free',
          name: 'Free',
          priceMonthly: 0,
          status: 'trialing',
          currentPeriodStart: '2026-05-01T00:00:00.000Z',
          currentPeriodEnd: '2026-06-08T00:00:00.000Z',
        },
        subscription: mockBillingSubscription({
          subscriptionStatus: 'trialing',
          hasActivePaidSubscription: false,
        }),
        entitlements: mockTrialBillingEntitlements(),
        usage: {
          ...buildBillingSummary().usage,
          aiCredits: {
            ...buildBillingSummary().usage.aiCredits,
            monthlyCredits: 50,
            monthlyCreditsUsed: 10,
            monthlyCreditsRemaining: 40,
            totalCreditsAvailable: 50,
            totalCreditsRemaining: 40,
          },
        },
      }),
    });

    expect(screen.getByText('Free trial')).toBeTruthy();
    expect(screen.getByText('50 trial credits total')).toBeTruthy();
    expect(screen.getByText('Trial credits do not renew')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Upgrade' })).toBeTruthy();
  });

  it('shows current plan footer when no upgrade is available', () => {
    renderWidget({
      billingSummary: buildBillingSummary({
        plan: {
          key: 'pro',
          name: 'Pro',
          priceMonthly: 99,
          status: 'active',
          currentPeriodStart: '2026-05-01T00:00:00.000Z',
          currentPeriodEnd: '2026-06-29T00:00:00.000Z',
        },
      }),
    });
    expect(screen.getByText('Current plan')).toBeTruthy();
    expect(screen.getByText('Pro')).toBeTruthy();
    expect(screen.getByText('$99/month')).toBeTruthy();
    expect(screen.queryByText('Upgrade Available')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Upgrade' })).toBeNull();
  });

  it('starts expanded on the primary sidebar by default', () => {
    renderWidget({ collapseContext: 'primary' });
    expect(screen.getByRole('button', { name: /ai credits/i }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(screen.getByText('Monthly AI credits')).toBeTruthy();
  });

  it('starts collapsed on the agent sidebar by default', () => {
    renderWidget({
      collapseContext: 'agent',
      billingSummary: buildBillingSummary({
        plan: {
          key: 'starter',
          name: 'Starter',
          priceMonthly: 49,
          status: 'active',
          currentPeriodStart: '2026-05-01T00:00:00.000Z',
          currentPeriodEnd: '2026-06-29T00:00:00.000Z',
        },
      }),
    });
    expect(screen.getByRole('button', { name: /ai credits/i }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(screen.getByText('Monthly AI credits')).toBeTruthy();
    expect(screen.getByText('12 / 50')).toBeTruthy();
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).toBeTruthy();
    expect(screen.queryByText('Upgrade Available')).toBeNull();
  });

  it('shows top-up credits in collapsed view when monthly credits are fully used', () => {
    renderWidget({
      collapseContext: 'agent',
      aiCredits: {
        periodStart: '',
        periodEnd: '',
        monthlyCredits: 500,
        monthlyCreditsUsed: 500,
        monthlyCreditsRemaining: 0,
        topUpCreditsRemaining: 1000,
        totalCreditsAvailable: 1500,
        totalCreditsRemaining: 1000,
        isOverLimit: false,
        byBot: [],
      },
      topUps: [
        {
          creditsPurchased: 1000,
          creditsRemaining: 1000,
          expiresAt: '2027-05-29T00:00:00.000Z',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });

    expect(screen.getByRole('button', { name: /ai credits/i }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(screen.getByText('Top-up credits')).toBeTruthy();
    expect(screen.getByText('0 / 1,000')).toBeTruthy();
    expect(screen.queryByText('Monthly AI credits')).toBeNull();
  });

  it('shows monthly credits in collapsed view when monthly credits remain', () => {
    renderWidget({
      collapseContext: 'agent',
      aiCredits: {
        periodStart: '',
        periodEnd: '',
        monthlyCredits: 500,
        monthlyCreditsUsed: 12,
        monthlyCreditsRemaining: 488,
        topUpCreditsRemaining: 1000,
        totalCreditsAvailable: 1500,
        totalCreditsRemaining: 1488,
        isOverLimit: false,
        byBot: [],
      },
      topUps: [
        {
          creditsPurchased: 1000,
          creditsRemaining: 1000,
          expiresAt: '2027-05-29T00:00:00.000Z',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });

    expect(screen.getByText('Monthly AI credits')).toBeTruthy();
    expect(screen.getByLabelText('Monthly AI credits used this billing period')).toBeTruthy();
    expect(screen.queryByText('Top-up credits')).toBeNull();
  });

  it('shows auto top-up status when active', () => {
    renderWidget({
      billingSummary: buildBillingSummary({
        autoTopUp: {
          status: 'active',
          enabled: true,
          checkoutAvailable: true,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: '2026-06-29T00:00:00.000Z',
          packsThisBillingPeriod: 0,
          maxPacksPerBillingPeriod: 5,
          packCredits: 1000,
          packPriceUsd: 30,
        },
      }),
    });
    expect(screen.getByText('Auto top-up: Active')).toBeTruthy();
  });

  it('shows monthly credits in collapsed view when top-ups exist but monthly credits remain', () => {
    renderWidget({
      collapseContext: 'agent',
      aiCredits: {
        periodStart: '',
        periodEnd: '',
        monthlyCredits: 500,
        monthlyCreditsUsed: 0,
        monthlyCreditsRemaining: 500,
        topUpCreditsRemaining: 1000,
        totalCreditsAvailable: 1500,
        totalCreditsRemaining: 1500,
        isOverLimit: false,
        byBot: [],
      },
      topUps: [
        {
          creditsPurchased: 1000,
          creditsRemaining: 1000,
          expiresAt: '2027-05-29T00:00:00.000Z',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });

    expect(screen.getByText('Monthly AI credits')).toBeTruthy();
    expect(screen.getByLabelText('Monthly AI credits used this billing period')).toBeTruthy();
    expect(screen.queryByText('Top-up credits')).toBeNull();
  });

  it('persists collapsed preference for the primary sidebar in local storage', () => {
    renderWidget({ collapseContext: 'primary' });
    fireEvent.click(screen.getByRole('button', { name: /ai credits/i }));
    expect(screen.getByRole('button', { name: /ai credits/i }).getAttribute('aria-expanded')).toBe(
      'false',
    );

    cleanup();
    renderWidget({ collapseContext: 'primary' });
    expect(screen.getByRole('button', { name: /ai credits/i }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('always starts collapsed on the agent sidebar even when a legacy preference exists', () => {
    window.localStorage.setItem(
      APP_SHELL_CREDITS_WIDGET_COLLAPSE_STORAGE_KEY,
      JSON.stringify({ primary: false, agent: false }),
    );

    renderWidget({ collapseContext: 'agent' });
    expect(screen.getByRole('button', { name: /ai credits/i }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });
});
