import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PaidPlanFeatureCallout,
  PaidPlanFeatureCalloutForReason,
} from './PaidPlanFeatureCallout';
import { resolvePaidPlanFeatureCalloutPreset } from '@/lib/paidPlanFeatureCalloutCopy';

const mockOpenUpgradeModal = vi.fn();

vi.mock('@/hooks/useWorkspaceBillingSummary', () => ({
  useWorkspaceBillingSummary: () => ({
    summary: null,
    loadState: 'ready',
    errorMessage: null,
    loadSummary: vi.fn(),
  }),
  buildWorkspaceBillingSessionKey: () => 'session',
}));

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: {
      id: 'user-owner',
      activeWorkspaceId: 'ws-1',
      workspaceIds: ['ws-1'],
      workspaces: [{ id: 'ws-1', role: 'owner', planKey: 'free' }],
    },
  }),
}));

vi.mock('@/api/customerApi', () => ({
  getWorkspaceBillingSummary: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      workspaceId: 'ws-1',
      plan: { key: 'free', name: 'Free', priceMonthly: 0, status: 'trialing', currentPeriodStart: '', currentPeriodEnd: '' },
      entitlements: {},
      usage: {},
      planCatalog: [],
      addonCatalog: [],
      activeAddons: [],
    },
  }),
}));

vi.mock('@/components/billing/UpgradePlanModalProvider', () => ({
  useUpgradePlanModal: () => ({
    openUpgradeModal: mockOpenUpgradeModal,
    closeUpgradeModal: vi.fn(),
  }),
  UpgradePlanModalProvider: ({ children }: { children: ReactNode }) => children,
}));

function renderWithProvider(ui: ReactNode) {
  return render(ui);
}

describe('PaidPlanFeatureCallout', () => {
  afterEach(() => {
    cleanup();
    mockOpenUpgradeModal.mockReset();
  });

  it('renders title, description, and action label', () => {
    renderWithProvider(
      <PaidPlanFeatureCallout
        title="Export reports on Starter and Pro"
        description="Upgrade to export reports and leads for your team."
        reason="export"
      />,
    );

    expect(screen.getByText('Export reports on Starter and Pro')).toBeTruthy();
    expect(screen.getByText('Upgrade to export reports and leads for your team.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View plans' })).toBeTruthy();
  });

  it('opens plans modal when action is clicked', () => {
    renderWithProvider(
      <PaidPlanFeatureCallout
        title="Auto-train is available on paid plans"
        description="Upgrade to Starter or Pro to automatically train your agent when knowledge changes."
        reason="auto_train"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View plans' }));
    expect(mockOpenUpgradeModal).toHaveBeenCalledWith({ reason: 'auto_train' });
  });

  it('uses preset copy for auto_train reason', () => {
    const preset = resolvePaidPlanFeatureCalloutPreset('auto_train');
    renderWithProvider(<PaidPlanFeatureCalloutForReason reason="auto_train" compact />);

    expect(screen.getByText(preset.title)).toBeTruthy();
    expect(screen.getByText(preset.description)).toBeTruthy();
  });
});
