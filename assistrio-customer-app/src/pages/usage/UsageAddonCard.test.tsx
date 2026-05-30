import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsageAddonCard } from './UsageAddonCard';
import { resolvePaidPlanFeatureCalloutPreset } from '@/lib/paidPlanFeatureCalloutCopy';

const mockOpenUpgradeModal = vi.fn();

vi.mock('@/components/billing/UpgradePlanModalProvider', () => ({
  useUpgradePlanModal: () => ({
    openUpgradeModal: mockOpenUpgradeModal,
    closeUpgradeModal: vi.fn(),
  }),
}));

describe('UsageAddonCard', () => {
  afterEach(() => {
    cleanup();
    mockOpenUpgradeModal.mockReset();
  });

  it('shows paid-plan callout for locked add-ons', () => {
    const preset = resolvePaidPlanFeatureCalloutPreset('addons');
    render(
      <UsageAddonCard
        addon={{
          key: 'extra_bot',
          name: 'Extra bot',
          billingInterval: 'monthly',
          priceUsd: 49,
          scope: 'workspace',
          checkoutAvailable: false,
        }}
      />,
    );

    expect(screen.getByText(preset.title)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'View plans' }));
    expect(mockOpenUpgradeModal).toHaveBeenCalledWith({ reason: 'addons' });
  });
});
