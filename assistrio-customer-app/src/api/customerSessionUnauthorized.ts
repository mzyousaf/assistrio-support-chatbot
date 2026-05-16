/**
 * Central gate for "customer session no longer valid" when API returns 401 while the user
 * was fully signed in. Uses a short debounce so parallel requests do not amplify work.
 *
 * Note: Customer routes use 401 for missing/invalid session (see CustomerSessionAuthGuard).
 * 403 is used for in-session authorization (e.g. workspace/bot forbidden) and must not sign the user out.
 */

const STORAGE_KEY = 'assistrio_customer_session_ended';

let getIsFullyAuthenticated: () => boolean = () => false;
let invalidateSession: (() => void) | null = null;

let last401HandledAt = 0;
const DEBOUNCE_MS = 500;

export function registerCustomerSessionUnauthorizedGate(
  getAuthenticated: () => boolean,
  onUnauthorizedWhileAuthenticated: () => void,
) {
  getIsFullyAuthenticated = getAuthenticated;
  invalidateSession = onUnauthorizedWhileAuthenticated;
}

export function unregisterCustomerSessionUnauthorizedGate() {
  getIsFullyAuthenticated = () => false;
  invalidateSession = null;
}

export function markCustomerSessionEndedForLoginBanner() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* private mode / quota */
  }
}

/** Read-once helper for the login screen (clears the flag). */
export function readAndClearCustomerSessionEndedBanner(): boolean {
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

export function notifyCustomerFetchUnauthorized(
  status: number,
  _path: string,
  options?: { skip?: boolean },
) {
  if (options?.skip || status !== 401) return;
  if (!getIsFullyAuthenticated()) return;
  const now = Date.now();
  if (now - last401HandledAt < DEBOUNCE_MS) return;
  last401HandledAt = now;
  markCustomerSessionEndedForLoginBanner();
  invalidateSession?.();
}
