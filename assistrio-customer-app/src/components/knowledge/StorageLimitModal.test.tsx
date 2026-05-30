import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KnowledgePlanLimitDetailActions,
  StorageLimitModal,
} from '@/components/knowledge/StorageLimitModal';
import { resolvePaidPlanFeatureCalloutPreset } from '@/lib/paidPlanFeatureCalloutCopy';

const mockOpenUpgradeModal = vi.fn();

vi.mock('@/components/billing/UpgradePlanModalProvider', () => ({
  useUpgradePlanModal: () => ({
    openUpgradeModal: mockOpenUpgradeModal,
    closeUpgradeModal: vi.fn(),
  }),
}));

describe('StorageLimitModal', () => {
  afterEach(() => {
    cleanup();
    mockOpenUpgradeModal.mockReset();
  });

  it('shows trained knowledge callout and opens upgrade modal from footer action', () => {
    const preset = resolvePaidPlanFeatureCalloutPreset('trained_knowledge');
    render(
      <MemoryRouter>
        <StorageLimitModal open botId="bot-1" onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText(preset.title)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /upgrade plan/i }));
    expect(mockOpenUpgradeModal).toHaveBeenCalledWith({ reason: 'trained_knowledge' });
  });
});

describe('KnowledgePlanLimitDetailActions', () => {
  afterEach(() => {
    cleanup();
    mockOpenUpgradeModal.mockReset();
  });

  it('opens upgrade modal when upgrade plan is clicked', () => {
    render(
      <MemoryRouter>
        <KnowledgePlanLimitDetailActions botId="bot-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /upgrade plan/i }));
    expect(mockOpenUpgradeModal).toHaveBeenCalledWith({ reason: 'trained_knowledge' });
  });
});
