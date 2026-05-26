import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildWorkspaceBillingSessionKey,
  useWorkspaceBillingSummary,
} from '@/hooks/useWorkspaceBillingSummary';

const mockGetWorkspaceBillingSummary = vi.fn();

vi.mock('@/api/customerApi', () => ({
  getWorkspaceBillingSummary: (...args: unknown[]) => mockGetWorkspaceBillingSummary(...args),
}));

function buildSummary(workspaceId: string) {
  return {
    workspaceId,
    plan: { key: 'free', name: 'Free', priceMonthly: 0, status: 'free', currentPeriodStart: '', currentPeriodEnd: '' },
    entitlements: {
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 50,
      kbStorageMbPerBot: 5,
      maxKbStorageMbPerBot: 40,
      analyticsHistoryDays: 7,
      canExportReports: false,
      showPoweredByAssistrio: true,
      canRemoveBranding: false,
      activeAddons: [],
      topUpCreditsRemaining: 0,
    },
    usage: {
      bots: { current: 0, limit: 1 },
      members: { current: 0, pendingInvites: 0, used: 0, limit: 3 },
      aiCredits: {
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
      },
      trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: '' },
    },
    planCatalog: [],
    addonCatalog: [],
  };
}

describe('buildWorkspaceBillingSessionKey', () => {
  it('builds a stable session key from customer session fields', () => {
    expect(
      buildWorkspaceBillingSessionKey({
        customerId: 'user-1',
        activeWorkspaceId: 'ws-1',
        workspaceIds: ['ws-1', 'ws-2'],
      }),
    ).toBe('user-1:ws-1:ws-1,ws-2');
  });
});

describe('useWorkspaceBillingSummary', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads billing summary for active workspace', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({ ok: true, data: buildSummary('ws-1') });

    const { result } = renderHook(() => useWorkspaceBillingSummary('ws-1'));

    await waitFor(() => {
      expect(result.current.loadState).toBe('ready');
    });

    expect(mockGetWorkspaceBillingSummary).toHaveBeenCalledWith('ws-1');
    expect(result.current.summary?.usage.aiCredits.monthlyCreditsUsed).toBe(12);
  });

  it('refetches when active workspace changes', async () => {
    mockGetWorkspaceBillingSummary.mockImplementation(async (workspaceId: string) => ({
      ok: true,
      data: buildSummary(workspaceId),
    }));

    const { result, rerender } = renderHook(
      ({ workspaceId }: { workspaceId: string | null }) => useWorkspaceBillingSummary(workspaceId),
      { initialProps: { workspaceId: 'ws-1' } },
    );

    await waitFor(() => {
      expect(result.current.summary?.workspaceId).toBe('ws-1');
    });

    rerender({ workspaceId: 'ws-2' });

    await waitFor(() => {
      expect(result.current.summary?.workspaceId).toBe('ws-2');
    });

    expect(mockGetWorkspaceBillingSummary).toHaveBeenCalledWith('ws-2');
  });

  it('refetches when session key changes', async () => {
    mockGetWorkspaceBillingSummary.mockResolvedValue({ ok: true, data: buildSummary('ws-1') });

    const { rerender } = renderHook(
      ({ sessionKey }: { sessionKey: string | null }) => useWorkspaceBillingSummary('ws-1', sessionKey),
      { initialProps: { sessionKey: 'user-1:ws-1:ws-1' } },
    );

    await waitFor(() => {
      expect(mockGetWorkspaceBillingSummary).toHaveBeenCalledTimes(1);
    });

    rerender({ sessionKey: 'user-1:ws-1:ws-1,ws-2' });

    await waitFor(() => {
      expect(mockGetWorkspaceBillingSummary).toHaveBeenCalledTimes(2);
    });
  });
});
