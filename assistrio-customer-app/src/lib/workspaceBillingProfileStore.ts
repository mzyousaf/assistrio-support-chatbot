import type { WorkspaceBillingProfile } from '@/api/types';

type ProfileListener = () => void;

const profileCache = new Map<string, WorkspaceBillingProfile | null>();
const listeners = new Map<string, Set<ProfileListener>>();

function notify(workspaceId: string): void {
  for (const listener of listeners.get(workspaceId) ?? []) {
    listener();
  }
}

export function getCachedWorkspaceBillingProfile(
  workspaceId: string,
): WorkspaceBillingProfile | null | undefined {
  if (!workspaceId) return undefined;
  return profileCache.has(workspaceId) ? (profileCache.get(workspaceId) ?? null) : undefined;
}

export function setCachedWorkspaceBillingProfile(
  workspaceId: string,
  profile: WorkspaceBillingProfile | null,
): void {
  if (!workspaceId) return;
  profileCache.set(workspaceId, profile);
  notify(workspaceId);
}

export function subscribeWorkspaceBillingProfile(
  workspaceId: string,
  listener: ProfileListener,
): () => void {
  if (!workspaceId) return () => undefined;
  const bucket = listeners.get(workspaceId) ?? new Set<ProfileListener>();
  bucket.add(listener);
  listeners.set(workspaceId, bucket);
  return () => {
    bucket.delete(listener);
    if (bucket.size === 0) listeners.delete(workspaceId);
  };
}

export function clearWorkspaceBillingProfileCache(workspaceId?: string): void {
  if (workspaceId) {
    profileCache.delete(workspaceId);
    notify(workspaceId);
    return;
  }
  profileCache.clear();
  for (const id of listeners.keys()) notify(id);
}
