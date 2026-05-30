import { useCallback, useEffect, useState } from 'react';
import { getWorkspaceBillingSummary } from '@/api/customerApi';
import type { WorkspaceBillingSummary } from '@/api/types';

export type WorkspaceBillingLoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Optional key that changes when customer session refreshes (same workspace, new session data). */
export function buildWorkspaceBillingSessionKey(input: {
  customerId?: string | null;
  activeWorkspaceId?: string | null;
  workspaceIds?: string[] | null;
}): string | null {
  if (!input.customerId) return null;
  const workspaceIds = (input.workspaceIds ?? []).join(',');
  return `${input.customerId}:${input.activeWorkspaceId ?? ''}:${workspaceIds}`;
}

export function useWorkspaceBillingSummary(
  activeWorkspaceId: string | null,
  sessionKey?: string | null,
) {
  const [summary, setSummary] = useState<WorkspaceBillingSummary | null>(null);
  const [loadState, setLoadState] = useState<WorkspaceBillingLoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!activeWorkspaceId) {
      setSummary(null);
      setLoadState('ready');
      setErrorMessage(null);
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);

    const result = await getWorkspaceBillingSummary(activeWorkspaceId);
    if (!result.ok) {
      setSummary(null);
      setLoadState('error');
      setErrorMessage(result.error?.trim() || 'Something went wrong while loading billing details.');
      return;
    }

    setSummary(result.data);
    setLoadState('ready');
  }, [activeWorkspaceId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary, sessionKey]);

  return {
    summary,
    loadState,
    errorMessage,
    loadSummary,
    /** Refetch without clearing the current summary (used for post-checkout refresh). */
    reload: loadSummary,
  };
}