import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceBillingProfile, WorkspaceBillingProfileInput } from '@/api/types';
import { getWorkspaceBillingProfile, patchWorkspaceBillingProfile } from '@/api/customerApi';
import { isCompleteBillingProfile } from '@/lib/billingProfileComplete';
import {
  getCachedWorkspaceBillingProfile,
  setCachedWorkspaceBillingProfile,
  subscribeWorkspaceBillingProfile,
} from '@/lib/workspaceBillingProfileStore';

export function useWorkspaceBillingProfile(workspaceId: string, enabled = true) {
  const cached = workspaceId ? getCachedWorkspaceBillingProfile(workspaceId) : undefined;
  const [profile, setProfile] = useState<WorkspaceBillingProfile | null>(cached ?? null);
  const [loading, setLoading] = useState(enabled && Boolean(workspaceId) && cached === undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const syncFromCache = useCallback(() => {
    if (!workspaceId) {
      setProfile(null);
      return;
    }
    const next = getCachedWorkspaceBillingProfile(workspaceId);
    if (next !== undefined) setProfile(next);
  }, [workspaceId]);

  const reload = useCallback(async () => {
    if (!workspaceId || !enabled) {
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);
    const result = await getWorkspaceBillingProfile(workspaceId);
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not load billing details.');
      setProfile(null);
      setCachedWorkspaceBillingProfile(workspaceId, null);
      return;
    }

    const nextProfile = result.data.profile ?? null;
    setProfile(nextProfile);
    setCachedWorkspaceBillingProfile(workspaceId, nextProfile);
  }, [enabled, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !enabled) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const cachedProfile = getCachedWorkspaceBillingProfile(workspaceId);
    if (cachedProfile !== undefined) {
      setProfile(cachedProfile);
      setLoading(false);
      return;
    }

    void reload();
  }, [enabled, reload, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !enabled) return undefined;
    return subscribeWorkspaceBillingProfile(workspaceId, syncFromCache);
  }, [enabled, syncFromCache, workspaceId]);

  const applyProfile = useCallback(
    (nextProfile: WorkspaceBillingProfile | null) => {
      if (!workspaceId) return;
      setProfile(nextProfile);
      setCachedWorkspaceBillingProfile(workspaceId, nextProfile);
    },
    [workspaceId],
  );

  const saveProfile = useCallback(
    async (input: WorkspaceBillingProfileInput) => {
      if (!workspaceId) return { ok: false as const, error: 'No workspace selected.' };
      setSaving(true);
      setError(null);
      const result = await patchWorkspaceBillingProfile(workspaceId, input);
      setSaving(false);

      if (!result.ok) {
        setError(result.error ?? 'Could not save billing details.');
        return result;
      }

      applyProfile(result.data.profile);
      return result;
    },
    [applyProfile, workspaceId],
  );

  return {
    profile,
    loading,
    error,
    saving,
    reload,
    saveProfile,
    applyProfile,
    hasProfile: Boolean(profile),
    hasCompleteProfile: isCompleteBillingProfile(profile),
  };
}
