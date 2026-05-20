export const WORKSPACE_UNSAVED_MESSAGE = 'You have unsaved changes. Discard them?';

type GuardEntry = {
  isDirty: () => boolean;
  discard: () => void;
};

const guards = new Map<string, GuardEntry>();

/**
 * Manual-save workspace sections register here so navigation and beforeunload
 * can prompt before discarding local edits.
 */
export function registerManualSaveGuard(key: string, isDirty: () => boolean, discard: () => void): () => void {
  guards.set(key, { isDirty, discard });
  return () => {
    guards.delete(key);
  };
}

export function hasManualSaveDirty(): boolean {
  for (const g of guards.values()) {
    if (g.isDirty()) return true;
  }
  return false;
}

export function hasManualSaveGuardDirty(key: string): boolean {
  const g = guards.get(key);
  return g ? g.isDirty() : false;
}

/** True if any guard except `excludeKey` is dirty (used for KB sub-nav: notes-only vs full discard). */
export function hasManualSaveDirtyExcluding(excludeKey: string): boolean {
  for (const [key, g] of guards) {
    if (key === excludeKey) continue;
    if (g.isDirty()) return true;
  }
  return false;
}

export function discardManualSaveGuard(key: string): void {
  const g = guards.get(key);
  if (g?.isDirty()) g.discard();
}

export function discardAllManualSaveGuards(): void {
  for (const g of guards.values()) {
    if (g.isDirty()) g.discard();
  }
}
