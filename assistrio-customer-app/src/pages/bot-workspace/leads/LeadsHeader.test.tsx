import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeadsHeader } from './LeadsHeader';
import { resolvePaidPlanFeatureCalloutPreset } from '@/lib/paidPlanFeatureCalloutCopy';

const mockOpenUpgradeModal = vi.fn();

vi.mock('@/components/billing/UpgradePlanModalProvider', () => ({
  useUpgradePlanModal: () => ({
    openUpgradeModal: mockOpenUpgradeModal,
    closeUpgradeModal: vi.fn(),
  }),
}));

describe('LeadsHeader export entitlement', () => {
  afterEach(() => cleanup());

  it('shows export paid-plan callout and opens upgrade flow when exportLocked', () => {
    const preset = resolvePaidPlanFeatureCalloutPreset('export');
    const onExportLocked = vi.fn();
    render(
      <LeadsHeader
        exportLocked
        exportDisabled={false}
        onExport={vi.fn()}
        onExportLocked={onExportLocked}
        refreshDisabled={false}
        refreshLoading={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText(preset.title)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'View plans' }));
    expect(onExportLocked).toHaveBeenCalledTimes(1);
  });
});
