import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetAppearanceSection } from './WidgetAppearanceSection';
import { resolvePaidPlanFeatureCalloutPreset } from '@/lib/paidPlanFeatureCalloutCopy';

const {
  mockPatchBot,
  mockSetAppearanceChatUiDraft,
  mockSoftReload,
  mockBotWorkspace,
  mockCustomerAuth,
  mockBillingSummary,
  mockOpenUpgradeModal,
} = vi.hoisted(() => {
  const mockSoftReload = vi.fn();
  const mockOpenUpgradeModal = vi.fn();
  const mockBotWorkspace = {
    bot: { id: 'bot-1', chatUI: { showBranding: true, showAssistrioBrandingPaid: false } },
    botId: 'bot-1',
    softReload: mockSoftReload,
    canManageBot: true,
  };
  const mockCustomerAuth = {
    customer: {
      id: 'user-1',
      workspaces: [{ id: 'ws-1', role: 'owner', name: 'Test' }],
      activeWorkspaceId: 'ws-1',
    },
  };
  const mockBillingSummary = {
    summary: {
      entitlements: { canRemoveBranding: false },
    },
    loadState: 'ready' as const,
    errorMessage: null,
    loadSummary: vi.fn(),
  };

  return {
    mockPatchBot: vi.fn(),
    mockSetAppearanceChatUiDraft: vi.fn(),
    mockSoftReload,
    mockBotWorkspace,
    mockCustomerAuth,
    mockBillingSummary,
    mockOpenUpgradeModal,
  };
});

vi.mock('@/components/billing/UpgradePlanModalProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/billing/UpgradePlanModalProvider')>();
  return {
    ...actual,
    useUpgradePlanModal: () => ({
      openUpgradeModal: mockOpenUpgradeModal,
      closeUpgradeModal: vi.fn(),
    }),
  };
});

vi.mock('../../api/customerApi', () => ({
  patchCustomerBot: (...args: unknown[]) => mockPatchBot(...args),
}));

vi.mock('../../auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => mockCustomerAuth,
}));

vi.mock('../../hooks/useWorkspaceBillingSummary', () => ({
  useWorkspaceBillingSummary: () => mockBillingSummary,
}));

vi.mock('./BotWorkspaceContext', () => ({
  useBotWorkspace: () => mockBotWorkspace,
}));

vi.mock('./CustomerWidgetPreviewContext', () => ({
  useCustomerWidgetPreview: () => ({
    setAppearanceChatUiDraft: mockSetAppearanceChatUiDraft,
  }),
}));

describe('WidgetAppearanceSection branding entitlement', () => {
  afterEach(() => {
    cleanup();
    mockPatchBot.mockReset();
    mockSetAppearanceChatUiDraft.mockReset();
    mockSoftReload.mockReset();
    mockOpenUpgradeModal.mockReset();
  });

  it('shows branding paid-plan callout when canRemoveBranding=false', () => {
    const preset = resolvePaidPlanFeatureCalloutPreset('branding');
    render(
      <MemoryRouter>
        <WidgetAppearanceSection />
      </MemoryRouter>,
    );

    expect(screen.getByText(preset.title)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Assistrio branding' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View plans' })).toBeTruthy();
    const brandingSwitch = document.getElementById('appearance-show-branding');
    expect(brandingSwitch).toBeTruthy();
    expect(brandingSwitch?.hasAttribute('disabled')).toBe(false);
    const assistrioSwitch = document.getElementById('appearance-show-assistrio-branding-paid');
    expect(assistrioSwitch?.hasAttribute('disabled')).toBe(true);
  });

  it('opens upgrade modal from branding callout', () => {
    render(
      <MemoryRouter>
        <WidgetAppearanceSection />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View plans' }));
    expect(mockOpenUpgradeModal).toHaveBeenCalledWith({ reason: 'branding' });
  });

  it('does not send hidden Assistrio branding on save when locked', async () => {
    mockPatchBot.mockResolvedValue({ ok: true, data: {} });

    render(
      <MemoryRouter>
        <WidgetAppearanceSection />
      </MemoryRouter>,
    );

    const brandingLineToggle = document.getElementById('appearance-show-branding');
    expect(brandingLineToggle).toBeTruthy();
    fireEvent.click(brandingLineToggle!);
    fireEvent.click(screen.getByRole('button', { name: /save widget appearance/i }));

    await waitFor(() => {
      expect(mockPatchBot).toHaveBeenCalled();
    });

    const payload = mockPatchBot.mock.calls[0]?.[1] as {
      chatUI?: { showBranding?: boolean; showAssistrioBrandingPaid?: boolean };
    };
    expect(payload.chatUI?.showAssistrioBrandingPaid).not.toBe(false);
    expect(payload.chatUI?.showBranding).toBe(false);
  });
});
