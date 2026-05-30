import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBillingSubscriptionActions } from './useBillingSubscriptionActions';

const mockRestoreWorkspaceSubscription = vi.fn();
const mockChangeWorkspaceSubscriptionPlan = vi.fn();

vi.mock('@/api/customerApi', () => ({
  restoreWorkspaceSubscription: (...args: unknown[]) => mockRestoreWorkspaceSubscription(...args),
  changeWorkspaceSubscriptionPlan: (...args: unknown[]) =>
    mockChangeWorkspaceSubscriptionPlan(...args),
}));

vi.mock('@/lib/app-toast', () => ({
  appToast: { error: vi.fn(), success: vi.fn() },
}));

describe('useBillingSubscriptionActions', () => {
  beforeEach(() => {
    mockRestoreWorkspaceSubscription.mockResolvedValue({
      ok: true,
      data: {
        message: 'Subscription restored.',
        summary: { workspaceId: 'ws-1' },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('restoreSubscription calls restore API', async () => {
    const onSummaryUpdated = vi.fn();
    const { result } = renderHook(() =>
      useBillingSubscriptionActions('ws-1', onSummaryUpdated),
    );

    await waitFor(async () => {
      const ok = await result.current.restoreSubscription();
      expect(ok).toBe(true);
    });

    expect(mockRestoreWorkspaceSubscription).toHaveBeenCalledWith('ws-1');
  });
});
