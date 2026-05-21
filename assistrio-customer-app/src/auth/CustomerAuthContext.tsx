import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  registerCustomerSessionUnauthorizedGate,
  unregisterCustomerSessionUnauthorizedGate,
} from '../api/customerSessionUnauthorized';
import { getCustomerBots, getCustomerMe, postCustomerLogout } from '../api/customerApi';
import type { CustomerMe } from '../api/types';
import { clearCustomerSetupFinished, readSetupFinished } from '../onboarding/onboardingSessionStorage';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export type CustomerAuthValue = {
  status: AuthStatus;
  /** Set when a 401 arrived while `authenticated`; cleared after successful bootstrap or explicit clear. */
  sessionInvalidatedByApi: boolean;
  customer: CustomerMe | null;
  /** After session is valid, null until the bots list request finishes. */
  needsOnboarding: boolean | null;
  bootstrapError: string | null;
  refresh: () => Promise<void>;
  /** Best-effort backend logout; always clears local customer auth state. */
  logout: () => Promise<void>;
  logoutInFlight: boolean;
  logoutError: string | null;
  clearLogoutError: () => void;
  /** Re-run bots list to refresh needsOnboarding (e.g. after creating a draft). */
  refreshOnboardingHeuristic: () => Promise<void>;
  /** Clears the API-invalidation marker (e.g. after login screen has shown the message). */
  clearSessionInvalidatedByApi: () => void;
};

const CustomerAuthContext = createContext<CustomerAuthValue | null>(null);

async function loadOnboardingFlags(): Promise<{
  needsOnboarding: boolean;
  bootstrapWarn: boolean;
}> {
  const allRes = await getCustomerBots();
  if (!allRes.ok) {
    return { needsOnboarding: !readSetupFinished(), bootstrapWarn: true };
  }
  const publishedCount = allRes.data.filter((b) => b.status === 'published').length;
  const totalCount = allRes.data.length;
  if (totalCount === 0) {
    clearCustomerSetupFinished();
  }
  const setupFinished = readSetupFinished();
  const needsOnboarding = publishedCount === 0 && !setupFinished;
  return { needsOnboarding, bootstrapWarn: false };
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [customer, setCustomer] = useState<CustomerMe | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [logoutInFlight, setLogoutInFlight] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [sessionInvalidatedByApi, setSessionInvalidatedByApi] = useState(false);

  const statusRef = useRef<AuthStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useLayoutEffect(() => {
    registerCustomerSessionUnauthorizedGate(
      () => statusRef.current === 'authenticated',
      () => {
        setSessionInvalidatedByApi(true);
        setCustomer(null);
        setStatus('anonymous');
        setNeedsOnboarding(null);
        setBootstrapError(null);
        setLogoutInFlight(false);
        setLogoutError(null);
      },
    );
    return () => unregisterCustomerSessionUnauthorizedGate();
  }, []);

  const clearSessionInvalidatedByApi = useCallback(() => setSessionInvalidatedByApi(false), []);

  const refresh = useCallback(async () => {
    setBootstrapError(null);
    setSessionInvalidatedByApi(false);
    setStatus('loading');
    setNeedsOnboarding(null);
    const me = await getCustomerMe();
    if (me.ok) {
      setCustomer(me.data);
      setStatus('authenticated');
      const { needsOnboarding: need, bootstrapWarn } = await loadOnboardingFlags();
      if (bootstrapWarn) {
        setBootstrapError('Could not load assistants. You can retry from the Agents page.');
      }
      setNeedsOnboarding(need);
      return;
    }
    if (me.status === 401 || me.status === 403) {
      setCustomer(null);
      setStatus('anonymous');
      setNeedsOnboarding(null);
      return;
    }
    setCustomer(null);
    setStatus('anonymous');
    setNeedsOnboarding(null);
    setBootstrapError(me.error);
  }, []);

  const refreshOnboardingHeuristic = useCallback(async () => {
    if (status !== 'authenticated') return;
    const { needsOnboarding: need } = await loadOnboardingFlags();
    setNeedsOnboarding(need);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearLogoutError = useCallback(() => setLogoutError(null), []);

  const clearLocalCustomerAuthState = useCallback(() => {
    setCustomer(null);
    setStatus('anonymous');
    setNeedsOnboarding(null);
    setBootstrapError(null);
    setSessionInvalidatedByApi(false);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setLogoutError(null);
    setLogoutInFlight(true);
    try {
      await postCustomerLogout();
    } finally {
      clearLocalCustomerAuthState();
      setLogoutInFlight(false);
    }
  }, [clearLocalCustomerAuthState]);

  const value = useMemo(
    () => ({
      status,
      sessionInvalidatedByApi,
      customer,
      needsOnboarding,
      bootstrapError,
      refresh,
      logout,
      logoutInFlight,
      logoutError,
      clearLogoutError,
      refreshOnboardingHeuristic,
      clearSessionInvalidatedByApi,
    }),
    [
      status,
      sessionInvalidatedByApi,
      customer,
      needsOnboarding,
      bootstrapError,
      refresh,
      logout,
      logoutInFlight,
      logoutError,
      clearLogoutError,
      refreshOnboardingHeuristic,
      clearSessionInvalidatedByApi,
    ],
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  }
  return ctx;
}
