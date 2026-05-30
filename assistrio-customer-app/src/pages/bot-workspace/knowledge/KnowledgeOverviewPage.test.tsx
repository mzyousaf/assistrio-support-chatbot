import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpgradePlanModalProvider } from '@/components/billing/UpgradePlanModalProvider';
import { mockTrialWorkspaceSummary } from '@/lib/planEntitlements';
import { resolvePaidPlanFeatureCalloutPreset } from '@/lib/paidPlanFeatureCalloutCopy';
import { knowledgeOverviewResponseCache } from './knowledgeRouteDataCache';
import { KnowledgeOverviewPage } from './KnowledgeOverviewPage';

const mockGetOverview = vi.fn();
const mockOpenUpgradeModal = vi.fn();

const emptyTypeBlock = {
  total: 0,
  ready: 0,
  pending: 0,
  queued: 0,
  processing: 0,
  failed: 0,
  uiOnly: 0,
  totalCharacters: 0,
  readyCharacters: 0,
  pendingCharacters: 0,
  queuedCharacters: 0,
  processingCharacters: 0,
  failedCharacters: 0,
  uiOnlyCharacters: 0,
};

function buildOverviewMock() {
  return {
    botId: 'bot-1',
    knowledgeTraining: { autoTrainEnabled: false, trainingDelayMinutes: 15, scheduleMode: 'smart' as const },
    knowledgeStats: {
      totalCharacters: 0,
      totalItems: 0,
      readyCharacters: 0,
      pendingCharacters: 0,
      queuedCharacters: 0,
      processingCharacters: 0,
      failedCharacters: 0,
      uiOnlyCharacters: 0,
      readyItems: 0,
      pendingItems: 0,
      queuedItems: 0,
      processingItems: 0,
      failedItems: 0,
      uiOnlyItems: 0,
      byType: {
        snippets: emptyTypeBlock,
        qna: emptyTypeBlock,
        documents: emptyTypeBlock,
        datasheets: emptyTypeBlock,
        suggestions: emptyTypeBlock,
      },
      lastTrainedAt: null,
    },
    queue: {
      queuedItems: 0,
      queuedCharacters: 0,
      processingItems: 0,
      processingCharacters: 0,
      estimatedTrainingSeconds: 0,
      estimatedLabel: '',
    },
    pending: { items: 0, characters: 0 },
    failed: { items: 0, characters: 0 },
    knowledgeUsage: { totalBytes: 0, maxBytes: 5_000_000 },
  };
}

vi.mock('@/api/customerApi', () => ({
  getCustomerBotKnowledgeOverview: (...args: unknown[]) => mockGetOverview(...args),
  patchCustomerBotKnowledgeReplyPriority: vi.fn(),
  patchCustomerBotKnowledgeTrainingSettings: vi.fn(),
  postCustomerBotRetrainAgent: vi.fn(),
}));

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: {
      id: 'user-owner',
      activeWorkspaceId: 'ws-1',
      workspaceIds: ['ws-1'],
      workspaces: [{ ...mockTrialWorkspaceSummary(), role: 'owner' as const }],
    },
  }),
}));

vi.mock('@/hooks/useWorkspaceBillingSummary', () => ({
  useWorkspaceBillingSummary: () => ({
    summary: null,
    loadState: 'ready',
    errorMessage: null,
    loadSummary: vi.fn(),
  }),
  buildWorkspaceBillingSessionKey: () => 'session',
}));

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

vi.mock('../BotWorkspaceContext', () => ({
  useCanManageBot: () => true,
}));

vi.mock('@/context/KbWorkspacePollingContext', () => ({
  useKbWorkspacePolling: () => ({
    trainingStatus: null,
    trainingStatusError: null,
    trainingStatusPeekRef: { current: null },
    kbSectionStatusTrailingTicksRemainingRef: { current: 0 },
  }),
  useKbPollRegistration: () => undefined,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/bots/bot-1/playground/knowledgebase/overview']}>
      <UpgradePlanModalProvider>
        <Routes>
          <Route path="/bots/:id/playground/knowledgebase/overview" element={<KnowledgeOverviewPage />} />
        </Routes>
      </UpgradePlanModalProvider>
    </MemoryRouter>,
  );
}

describe('KnowledgeOverviewPage auto-train entitlement', () => {
  beforeEach(() => {
    knowledgeOverviewResponseCache.clear();
    mockOpenUpgradeModal.mockReset();
    mockGetOverview.mockResolvedValue({ ok: true, data: buildOverviewMock() });
  });

  afterEach(() => cleanup());

  it('shows paid-plan callout when auto-train is locked', async () => {
    const preset = resolvePaidPlanFeatureCalloutPreset('auto_train');
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(preset.title)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'View plans' }));
    expect(mockOpenUpgradeModal).toHaveBeenCalledWith({ reason: 'auto_train' });
  });
});
