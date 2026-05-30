import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerMe, WorkspaceBillingSummary } from '@/api/types';
import { TRAINED_KNOWLEDGE_STORAGE_HELPER } from '@/lib/trainedKnowledgeStorageCopy';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements, mockTrialWorkspaceSummary } from '@/lib/planEntitlements';
import { SettingsBillingPage } from './PlansPage';

const mockGetWorkspaceBillingSummary = vi.fn();
const mockGetWorkspaceBillingInvoices = vi.fn();
const mockFetchWorkspaceBillingInvoicePdf = vi.fn();
const mockFetchWorkspaceBillingHistoryCsv = vi.fn();
const mockGetWorkspaceBillingProfile = vi.fn();
const mockCreateBillingManageSession = vi.fn();
const mockRestoreWorkspaceSubscription = vi.fn();

const mockCancelWorkspaceAddon = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getWorkspaceBillingSummary: (...args: unknown[]) => mockGetWorkspaceBillingSummary(...args),
  getWorkspaceBillingInvoices: (...args: unknown[]) => mockGetWorkspaceBillingInvoices(...args),
  getWorkspaceBillingProfile: (...args: unknown[]) => mockGetWorkspaceBillingProfile(...args),
  fetchWorkspaceBillingInvoicePdf: (...args: unknown[]) =>
    mockFetchWorkspaceBillingInvoicePdf(...args),
  fetchWorkspaceBillingHistoryCsv: (...args: unknown[]) =>
    mockFetchWorkspaceBillingHistoryCsv(...args),
  createBillingManageSession: (...args: unknown[]) => mockCreateBillingManageSession(...args),
  restoreWorkspaceSubscription: (...args: unknown[]) => mockRestoreWorkspaceSubscription(...args),
  cancelWorkspaceAddon: (...args: unknown[]) => mockCancelWorkspaceAddon(...args),
  getCustomerBots: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  createAddonCheckoutSession: vi.fn(),
  createTopUpCheckoutSession: vi.fn(),
  createPlanCheckoutSession: vi.fn(),
  changeWorkspaceSubscriptionPlan: vi.fn(),
}));

const baseWorkspace = mockTrialWorkspaceSummary();

const ownerCustomer: CustomerMe = {
  id: 'user-owner',
  email: 'owner@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-1',
  workspaceIds: ['ws-1'],
  workspaces: [{ ...baseWorkspace, role: 'owner' as const }],
};

const adminCustomer: CustomerMe = {
  ...ownerCustomer,
  id: 'user-admin',
  email: 'admin@example.com',
  workspaces: [{ ...baseWorkspace, role: 'admin' as const }],
};

function buildSummary(overrides?: Partial<WorkspaceBillingSummary>): WorkspaceBillingSummary {
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
      bots: { current: 1, limit: 1 },
      members: { current: 2, pendingInvites: 1, used: 3, limit: 3 },
      aiCredits: {
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-06-01T00:00:00.000Z',
        monthlyCredits: 50,
        monthlyCreditsUsed: 12,
        monthlyCreditsRemaining: 38,
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: 50,
        totalCreditsRemaining: 38,
        isOverLimit: false,
        byBot: [],
      },
      trainedKnowledge: {
        perBot: [],
        totalUsedBytes: 1024 * 1024,
        note: TRAINED_KNOWLEDGE_STORAGE_HELPER,
      },
    },
    planCatalog: [],
    addonCatalog: [],
    activeAddons: [],
    topUps: [],
    ...overrides,
  };
}

let mockCustomer: CustomerMe | null = ownerCustomer;

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    status: 'authenticated',
    customer: mockCustomer,
    refresh: vi.fn(),
    logout: vi.fn(),
    logoutInFlight: false,
  }),
}));

vi.mock('@/components/billing/UpgradePlanModalProvider', () => ({
  useUpgradePlanModal: () => ({
    openUpgradeModal: vi.fn(),
    closeUpgradeModal: vi.fn(),
  }),
}));

function renderPage(initialEntry = '/settings/billing') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SettingsBillingPage />
    </MemoryRouter>,
  );
}

describe('SettingsBillingPage', () => {
  beforeEach(() => {
    mockCustomer = ownerCustomer;
    mockGetWorkspaceBillingSummary.mockResolvedValue({ ok: true, data: buildSummary() });
    mockGetWorkspaceBillingInvoices.mockResolvedValue({ ok: true, data: [] });
    mockGetWorkspaceBillingProfile.mockResolvedValue({ ok: true, data: { profile: null } });
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

  it('renders Billing & Invoices page title', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Billing & Invoices', level: 1 })).toBeTruthy();
    expect(
      screen.getByText('Manage your subscription, payment method, invoices, and add-ons.'),
    ).toBeTruthy();
  });

  it('renders current billing summary with view plans link', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Free trial', level: 2 })).toBeTruthy();
    expect(screen.getByText('Included credits')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View plans' }).getAttribute('href')).toBe('/settings/plans');
  });

  it('shows payment setup notice', async () => {
    renderPage();
    expect(await screen.findByText('Payment setup')).toBeTruthy();
    expect(screen.getByText(/Checkout and payment methods are not enabled yet/i)).toBeTruthy();
  });

  it('does not render usage snapshot', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Billing & Invoices', level: 1 });
    expect(screen.queryByText('Usage snapshot')).toBeNull();
  });

  it('shows future billing sections as coming soon', async () => {
    renderPage();
    expect(await screen.findByText('Billing management')).toBeTruthy();
    expect(screen.getByText('Payment method')).toBeTruthy();
    expect(screen.getByText('Invoices')).toBeTruthy();
    const comingSoonButtons = screen.getAllByRole('button', { name: 'Coming soon' });
    expect(comingSoonButtons.length).toBeGreaterThanOrEqual(3);
  });

  it('shows owner billing note', async () => {
    renderPage();
    expect(await screen.findByText('Checkout is not enabled yet.')).toBeTruthy();
  });

  it('billing page success query banner renders confirming payment', async () => {
    renderPage('/settings/billing?checkout=success');
    expect(
      await screen.findByText("Checkout completed. We're confirming your payment."),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Refresh billing status/i })).toBeTruthy();
  });

  it('refresh billing status refetches summary', async () => {
    renderPage('/settings/billing?checkout=success');
    await screen.findByText("Checkout completed. We're confirming your payment.");
    fireEvent.click(screen.getByRole('button', { name: /Refresh billing status/i }));
    await waitFor(() => {
      expect(mockGetWorkspaceBillingSummary.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows billing updated success when plan changes after refresh', async () => {
    let calls = 0;
    mockGetWorkspaceBillingSummary.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: true, data: buildSummary() };
      }
      return {
        ok: true,
        data: buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-07-01T00:00:00.000Z',
          },
          subscription: mockBillingSubscription({
            subscriptionStatus: 'active',
            hasActivePaidSubscription: true,
          }),
        }),
      };
    });

    renderPage('/settings/billing?checkout=success');
    await screen.findByText("Checkout completed. We're confirming your payment.");
    fireEvent.click(screen.getByRole('button', { name: /Refresh billing status/i }));
    expect(await screen.findByText('Billing updated successfully.', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('billing page cancelled query banner renders', async () => {
    renderPage('/settings/billing?checkout=cancelled');
    expect(await screen.findByText('Checkout was cancelled.')).toBeTruthy();
  });

  it('does not show manage billing or payment method manage buttons when checkout enabled', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-07-01T00:00:00.000Z',
          },
          subscription: mockBillingSubscription({
            provider: 'lemon_squeezy',
            subscriptionStatus: 'active',
            hasActivePaidSubscription: true,
            paymentMethod: { label: 'Visa ending in 4242', brand: 'visa', last4: '4242' },
          }),
        }),
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
        ],
      },
    });
    renderPage();
    await screen.findByText(/Visa ending in 4242/);
    expect(screen.queryByRole('button', { name: 'Manage billing' })).toBeNull();
    expect(screen.queryByRole('button', { name: /payment method/i })).toBeNull();
  });

  it('cancel opens Before you cancel modal and portal does not call cancel API', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
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
        }),
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
        ],
      },
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel subscription' }));
    expect(await screen.findByRole('heading', { name: 'Before you cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Lemon Squeezy' }));
    await waitFor(() => {
      expect(mockCreateBillingManageSession).toHaveBeenCalledWith('ws-1');
      expect(window.open).toHaveBeenCalledWith(
        'https://portal.lemonsqueezy.com/billing',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });

  it('shows cancel subscription for owner on active paid plan', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-07-01T00:00:00.000Z',
          },
          subscription: mockBillingSubscription({
            subscriptionStatus: 'active',
            hasActivePaidSubscription: true,
            currentPeriodEnd: '2026-07-01T00:00:00.000Z',
          }),
        }),
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
        ],
      },
    });
    renderPage();
    expect(await screen.findByRole('button', { name: 'Cancel subscription' })).toBeTruthy();
  });

  it('hides cancel subscription for non-owner when checkout enabled', async () => {
    mockCustomer = adminCustomer;
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-07-01T00:00:00.000Z',
          },
          subscription: mockBillingSubscription({
            subscriptionStatus: 'active',
            hasActivePaidSubscription: true,
          }),
        }),
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
        ],
      },
    });
    cleanup();
    renderPage();
    await screen.findByText('Current plan');
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).toBeNull();
  });

  it('shows cancel-at-period-end restore banner', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          subscription: mockBillingSubscription({
            subscriptionStatus: 'active',
            cancelAtPeriodEnd: true,
            hasActivePaidSubscription: true,
            currentPeriodEnd: '2026-12-15T00:00:00.000Z',
          }),
        }),
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
        ],
      },
    });
    mockRestoreWorkspaceSubscription.mockResolvedValue({
      ok: true,
      data: { message: 'Subscription restored.', summary: buildSummary() },
    });
    renderPage();
    expect(await screen.findByText(/scheduled to cancel on/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore subscription' }));
    expect(await screen.findByRole('heading', { name: 'Restore subscription?' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Restore subscription' })[1]!);
    await waitFor(() => {
      expect(mockRestoreWorkspaceSubscription).toHaveBeenCalledWith('ws-1');
    });
  });

  it('shows invoice amount formatted and Download PDF action', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary(),
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
        ],
      },
    });
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'inv-1',
          provider: 'lemon_squeezy',
          date: '2026-05-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/1',
          receiptUrl: null,
          description: 'Starter subscription started',
          itemType: 'plan',
          itemKey: 'starter',
          itemName: 'Starter',
        },
      ],
    });
    mockFetchWorkspaceBillingInvoicePdf.mockResolvedValue({
      ok: true,
      data: {
        kind: 'pdf',
        blob: new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }),
        filename: 'assistrio-billing-inv-1.pdf',
      },
    });
    renderPage();
    expect(await screen.findByText('$49.00')).toBeTruthy();
    const invoicesSection = document.getElementById('billing-invoices');
    expect(invoicesSection).toBeTruthy();
    expect(within(invoicesSection!).getByText('Starter')).toBeTruthy();
    expect(within(invoicesSection!).getByText('Starter subscription started')).toBeTruthy();
    expect(within(invoicesSection!).queryByText('initial')).toBeNull();
    expect(within(invoicesSection!).queryByText('Trained knowledge storage')).toBeNull();
    expect(within(invoicesSection!).getByRole('button', { name: /Download PDF/i })).toBeTruthy();
    expect(within(invoicesSection!).getByRole('button', { name: /Download billing history/i })).toBeTruthy();
    expect(within(invoicesSection!).queryByRole('link', { name: /View invoice/i })).toBeNull();
  });

  it('shows Starter subscription and add-on invoice rows together', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          },
          subscription: mockBillingSubscription({
            provider: 'lemon_squeezy',
            subscriptionStatus: 'active',
            hasActivePaidSubscription: true,
          }),
        }),
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
        ],
      },
    });
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'lemon_subscription_invoice:inv-plan-1:sub-plan',
          provider: 'lemon_squeezy',
          date: '2026-05-01T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/starter',
          receiptUrl: null,
          description: 'Starter subscription started',
          itemType: 'plan',
          itemKey: 'starter',
          itemName: 'Starter',
        },
        {
          id: 'lemon_subscription_invoice:inv-addon-bot:sub-addon-bot',
          provider: 'lemon_squeezy',
          date: '2026-05-03T00:00:00.000Z',
          amount: 49,
          amountCents: 4900,
          amountFormatted: '$49.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: 'https://invoice.example/extra-bot',
          receiptUrl: null,
          description: 'Extra bot add-on',
          itemType: 'addon',
          itemKey: 'extra_bot',
          itemName: 'Extra bot',
        },
      ],
    });

    renderPage();

    const invoicesSection = await waitFor(() => {
      const section = document.getElementById('billing-invoices');
      expect(section).toBeTruthy();
      return section!;
    });
    expect(await within(invoicesSection).findByText('Starter')).toBeTruthy();
    expect(within(invoicesSection).getByText('Extra bot')).toBeTruthy();
    expect(within(invoicesSection).getAllByText('$49.00').length).toBeGreaterThanOrEqual(2);
  });

  it('shows past_due warning', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: buildSummary({
        subscription: mockBillingSubscription({
          subscriptionStatus: 'past_due',
          hasPaymentIssue: true,
        }),
      }),
    });
    renderPage();
    expect(await screen.findByText(/Payment issue detected/i)).toBeTruthy();
    expect(screen.getByText(/update your payment method to avoid losing access/i)).toBeTruthy();
  });

  it('renders current plan and add-ons in the first row when checkout enabled', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          },
          entitlements: {
            ...mockTrialBillingEntitlements(),
            isTrialPlan: false,
            addonsAllowed: true,
          },
        }),
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
        ],
        addonCatalog: [
          {
            key: 'extra_bot',
            name: 'Extra bot',
            billingInterval: 'monthly',
            priceUsd: 49,
            scope: 'workspace',
            checkoutAvailable: true,
            status: 'inactive',
          },
        ],
      },
    });

    renderPage();
    const row = await screen.findByTestId('billing-plan-addons-row');
    expect(row).toBeTruthy();
    expect(within(row).getByTestId('billing-current-plan')).toBeTruthy();
    expect(within(row).getByRole('heading', { name: 'Add-ons' })).toBeTruthy();
  });

  it('renders billing sections in required order', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-07-01T00:00:00.000Z',
          },
          entitlements: {
            ...mockTrialBillingEntitlements(),
            isTrialPlan: false,
            addonsAllowed: true,
          },
          subscription: mockBillingSubscription({
            subscriptionStatus: 'active',
            hasActivePaidSubscription: true,
            manageBillingAvailable: true,
            paymentMethod: { label: 'Visa ending in 4242', brand: 'visa', last4: '4242' },
          }),
        }),
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
        ],
        addonCatalog: [
          {
            key: 'extra_bot',
            name: 'Extra bot',
            billingInterval: 'monthly',
            priceUsd: 49,
            scope: 'workspace',
            checkoutAvailable: true,
            status: 'inactive',
          },
        ],
      },
    });

    renderPage();
    await screen.findByTestId('billing-plan-addons-row');

    const sectionNodes = [
      document.querySelector('[data-testid="billing-plan-addons-row"]'),
      document.getElementById('billing-manage-payments'),
      document.getElementById('billing-profile'),
      document.getElementById('billing-invoices'),
      document.getElementById('billing-cancel-subscription'),
    ];

    sectionNodes.forEach((node) => expect(node).toBeTruthy());

    for (let i = 0; i < sectionNodes.length - 1; i += 1) {
      expect(
        sectionNodes[i]!.compareDocumentPosition(sectionNodes[i + 1]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('manage in Lemon Squeezy opens portal in a new tab', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          },
          subscription: mockBillingSubscription({
            provider: 'lemon_squeezy',
            manageBillingAvailable: true,
            customerPortalAvailable: true,
            paymentMethod: { label: 'Visa ending in 4242', brand: 'visa', last4: '4242' },
          }),
        }),
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
        ],
      },
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Manage in Lemon Squeezy' }));
    await waitFor(() => {
      expect(mockCreateBillingManageSession).toHaveBeenCalledWith('ws-1');
      expect(window.open).toHaveBeenCalledWith(
        'https://portal.lemonsqueezy.com/billing',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });

  it('shows payment method and empty invoice history when checkout enabled', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary(),
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
        ],
        subscription: mockBillingSubscription({
          provider: 'lemon_squeezy',
          manageBillingAvailable: true,
          paymentMethod: { label: 'Visa ending in 4242', brand: 'visa', last4: '4242' },
        }),
      },
    });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Manage payments' })).toBeTruthy();
    expect(screen.getByText('Visa ending in 4242')).toBeTruthy();
    expect(screen.getByText('Stored securely by Lemon Squeezy')).toBeTruthy();
    expect(screen.getByText(/Update payment method and payment details securely in Lemon Squeezy/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage in Lemon Squeezy' })).toBeTruthy();
    expect(screen.queryByText(/Update payment details/i)).toBeNull();
    expect(await screen.findByText('No invoices yet.')).toBeTruthy();
  });

  it('shows non-owner billing note for admin', async () => {
    mockCustomer = adminCustomer;
    cleanup();
    renderPage();
    expect(
      await screen.findByText(
        'Only workspace owners will be able to manage billing when payments are enabled.',
      ),
    ).toBeTruthy();
  });

  it('handles no active workspace', async () => {
    mockCustomer = { ...ownerCustomer, activeWorkspaceId: null, workspaces: [] };
    renderPage();
    expect(await screen.findByText('No active workspace selected.')).toBeTruthy();
    expect(mockGetWorkspaceBillingSummary).not.toHaveBeenCalled();
  });

  it('handles API error with retry', async () => {
    mockGetWorkspaceBillingSummary
      .mockResolvedValueOnce({ ok: false, error: 'Network error' })
      .mockResolvedValueOnce({ ok: true, data: buildSummary() });

    renderPage();
    expect(await screen.findByText('Could not load billing details')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Billing & Invoices', level: 1 })).toBeTruthy();
  });

  it('shows loading skeleton while fetching', async () => {
    mockGetWorkspaceBillingSummary.mockImplementation(
      () => new Promise(() => {
        /* never resolves */
      }),
    );
    renderPage();
    expect(await screen.findByLabelText('Loading billing')).toBeTruthy();
  });

  it('shows all add-ons with inactive status and purchase actions when checkout enabled', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          },
          entitlements: {
            ...mockTrialBillingEntitlements(),
            isTrialPlan: false,
            addonsAllowed: true,
            monthlyAiCredits: 500,
          },
        }),
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
        ],
        addonCatalog: [
          {
            key: 'ai_credits_1000',
            name: '1,000 extra AI credits',
            billingInterval: 'one_time',
            priceUsd: 30,
            scope: 'workspace',
            checkoutAvailable: true,
            status: 'inactive',
            description: 'Extra credits are used only after your monthly plan credits are used.',
          },
          {
            key: 'extra_bot',
            name: 'Extra bot',
            billingInterval: 'monthly',
            priceUsd: 49,
            scope: 'workspace',
            checkoutAvailable: true,
            status: 'inactive',
          },
          {
            key: 'remove_branding',
            name: 'Remove Powered by Assistrio',
            billingInterval: 'monthly',
            priceUsd: 20,
            scope: 'workspace',
            checkoutAvailable: true,
            status: 'inactive',
          },
        ],
        topUps: [],
      },
    });

    renderPage();
    expect(await screen.findByRole('heading', { name: 'Add-ons' })).toBeTruthy();
    expect(screen.getByText('1,000 extra AI credits')).toBeTruthy();
    expect(screen.getByText('Extra agent')).toBeTruthy();
    expect(screen.getAllByText('Not active').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Buy credits' })).toBeTruthy();
  });

  it('shows AI credit top-up details in add-ons and Download PDF in invoices', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          },
          entitlements: {
            ...mockTrialBillingEntitlements(),
            isTrialPlan: false,
            addonsAllowed: true,
          },
        }),
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
        ],
        addonCatalog: [
          {
            key: 'ai_credits_1000',
            name: '1,000 extra AI credits',
            billingInterval: 'one_time',
            priceUsd: 30,
            scope: 'workspace',
            checkoutAvailable: true,
            status: 'inactive',
          },
        ],
        topUps: [
          {
            creditsPurchased: 1000,
            creditsRemaining: 800,
            expiresAt: '2027-05-01T00:00:00.000Z',
            createdAt: '2026-05-02T00:00:00.000Z',
            amountFormatted: '$30.00',
            receiptUrl: 'https://receipt.example/top-up',
          },
        ],
      },
    });
    mockGetWorkspaceBillingInvoices.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'order-top-up',
          provider: 'lemon_squeezy',
          date: '2026-05-02T00:00:00.000Z',
          amount: 30,
          amountCents: 3000,
          amountFormatted: '$30.00',
          currency: 'USD',
          status: 'paid',
          invoiceUrl: null,
          receiptUrl: 'https://receipt.example/top-up',
          description: '1,000 AI credits top-up',
          itemType: 'top_up',
          itemKey: 'ai_credits_1000',
          itemName: '1,000 AI credits',
          billingKind: 'order',
          requiresBillingDetails: false,
        },
      ],
    });

    renderPage();
    expect(await screen.findByText(/Top-up credits are used only after monthly plan credits/)).toBeTruthy();
    expect(screen.getByText(/800 of 1,000 remaining/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /View receipt/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /View invoice/i })).toBeNull();

    const invoicesSection = document.getElementById('billing-invoices');
    expect(invoicesSection).toBeTruthy();
    expect(await within(invoicesSection!).findByText('1,000 AI credits top-up')).toBeTruthy();
    expect(within(invoicesSection!).getByRole('button', { name: /Download PDF/i })).toBeTruthy();
  });

  it('opens cancel add-on confirmation modal for active recurring add-on', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({
      ok: true,
      data: {
        ...buildSummary({
          plan: {
            key: 'starter',
            name: 'Starter',
            priceMonthly: 49,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
          },
          entitlements: {
            ...mockTrialBillingEntitlements(),
            isTrialPlan: false,
            addonsAllowed: true,
          },
        }),
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
        ],
        addonCatalog: [
          {
            key: 'extra_bot',
            name: 'Extra bot',
            billingInterval: 'monthly',
            priceUsd: 49,
            scope: 'workspace',
            checkoutAvailable: true,
            status: 'active',
            active: true,
            currentPeriodEnd: '2026-06-01T00:00:00.000Z',
            effectLabel: '+1 agent (limit 2)',
          },
        ],
        topUps: [],
      },
    });
    mockCancelWorkspaceAddon.mockResolvedValue({
      ok: true,
      data: { message: 'Cancelled', summary: buildSummary() },
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel add-on' }));
    expect(
      await screen.findByText(/This add-on remains active until the end of the current billing period/i),
    ).toBeTruthy();
  });
});
