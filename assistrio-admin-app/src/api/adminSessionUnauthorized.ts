/**
 * Central gate for admin session invalidation on 401 while authenticated.
 */

const STORAGE_KEY = 'assistrio_admin_session_ended';

let getIsFullyAuthenticated: () => boolean = () => false;
let invalidateSession: (() => void) | null = null;

let last401HandledAt = 0;
const DEBOUNCE_MS = 500;

export function registerAdminSessionUnauthorizedGate(
  getAuthenticated: () => boolean,
  onUnauthorizedWhileAuthenticated: () => void,
) {
  getIsFullyAuthenticated = getAuthenticated;
  invalidateSession = onUnauthorizedWhileAuthenticated;
}

export function unregisterAdminSessionUnauthorizedGate() {
  getIsFullyAuthenticated = () => false;
  invalidateSession = null;
}

export function markAdminSessionEndedForLoginBanner() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* private mode / quota */
  }
}

export function readAndClearAdminSessionEndedBanner(): boolean {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v) {
      sessionStorage.removeItem(STORAGE_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function notifyAdminFetchUnauthorized(
  status: number,
  _path: string,
  options?: { skip?: boolean },
) {
  if (options?.skip || status !== 401) return;
  if (!getIsFullyAuthenticated()) return;
  const now = Date.now();
  if (now - last401HandledAt < DEBOUNCE_MS) return;
  last401HandledAt = now;
  markAdminSessionEndedForLoginBanner();
  invalidateSession?.();
}
