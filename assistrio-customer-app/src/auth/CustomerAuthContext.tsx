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
import { getCustomerBots, getCustomerMe, postCustomerLogout, postCustomerWorkspaceActivate } from '../api/customerApi';
import type { CustomerMe, WorkspaceOnboardingStatus } from '../api/types';
import {
  buildCustomerBotsListQuery,
  shouldFetchBotsForOnboardingHeuristic,
} from '../lib/customerBotsQuery';
import {
  computeNeedsOnboardingForCustomer,
  resolveActiveCustomerWorkspace,
} from '../lib/resolveActiveCustomerWorkspace';
import { isWorkspaceMemberOnlyRole } from '../lib/workspaceRoles';
import {
  clearAllOnboardingLocalStorage,
} from '../onboarding/onboardingSessionStorage';

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
  /** Optimistically sync primary workspace onboarding status after POST /complete. */
  patchPrimaryWorkspaceOnboardingStatus: (status: WorkspaceOnboardingStatus) => void;
  /** Switch active workspace via POST /activate and refresh session + onboarding flags. */
  activateWorkspace: (workspaceId: string) => Promise<CustomerMe | null>;
  /** Replace session customer after profile save without full bootstrap reload. */
  applyCustomerSession: (next: CustomerMe) => void;
  /** Clears the API-invalidation marker (e.g. after login screen has shown the message). */
  clearSessionInvalidatedByApi: () => void;
};

const CustomerAuthContext = createContext<CustomerAuthValue | null>(null);

async function loadOnboardingFlags(customer: CustomerMe | null): Promise<{
  needsOnboarding: boolean;
  bootstrapWarn: boolean;
}> {
  const { onboardingStatus, role, activeWorkspaceId } = resolveActiveCustomerWorkspace(customer);

  if (isWorkspaceMemberOnlyRole(role)) {
    return { needsOnboarding: false, bootstrapWarn: false };
  }

  if (onboardingStatus === 'completed') {
    return { needsOnboarding: false, bootstrapWarn: false };
  }

  if (
    onboardingStatus === 'live_pending_install' ||
    onboardingStatus === 'in_progress' ||
    onboardingStatus === 'not_started'
  ) {
    return { needsOnboarding: true, bootstrapWarn: false };
  }

  if (onboardingStatus != null) {
    return { needsOnboarding: true, bootstrapWarn: false };
  }

  if (!shouldFetchBotsForOnboardingHeuristic({ role: role ?? null, onboardingStatus })) {
    return { needsOnboarding: false, bootstrapWarn: false };
  }

  const botsQuery = buildCustomerBotsListQuery({ activeWorkspaceId });
  const allRes = await getCustomerBots(botsQuery ?? undefined);
  if (!allRes.ok) {
    const setupFinished = readSetupFinishedLegacy();
    return {
      needsOnboarding: computeNeedsOnboardingForCustomer(customer, {
        setupFinished,
        publishedCount: 0,
      }),
      bootstrapWarn: true,
    };
  }
  const publishedCount = allRes.data.filter((b) => b.status === 'published').length;
  const totalCount = allRes.data.length;
  if (totalCount === 0) {
    clearAllOnboardingLocalStorage();
  }
  const setupFinished = readSetupFinishedLegacy();
  return {
    needsOnboarding: computeNeedsOnboardingForCustomer(customer, {
      setupFinished,
      publishedCount,
    }),
    bootstrapWarn: false,
  };
}

function readSetupFinishedLegacy(): boolean {
  try {
    return localStorage.getItem('assistrio_customer.setup_finished_v1') === '1';
  } catch {
    return false;
  }
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
      const { needsOnboarding: need, bootstrapWarn } = await loadOnboardingFlags(me.data);
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
    const { needsOnboarding: need } = await loadOnboardingFlags(customer);
    setNeedsOnboarding(need);
  }, [status, customer]);

  const patchPrimaryWorkspaceOnboardingStatus = useCallback((nextStatus: WorkspaceOnboardingStatus) => {
    setCustomer((prev) => {
      if (!prev?.workspaces?.length) return prev;
      const activeId = resolveActiveCustomerWorkspace(prev).activeWorkspaceId;
      if (!activeId) return prev;
      const workspaces = prev.workspaces.map((workspace) =>
        workspace.id === activeId ? { ...workspace, onboardingStatus: nextStatus } : workspace,
      );
      const unchanged = workspaces.every((workspace, index) => workspace === prev.workspaces?.[index]);
      if (unchanged) return prev;
      return { ...prev, workspaces };
    });
    const activeRole = resolveActiveCustomerWorkspace(customer).role;
    setNeedsOnboarding(activeRole !== 'member' && nextStatus !== 'completed');
  }, [customer]);

  const activateWorkspace = useCallback(async (workspaceId: string): Promise<CustomerMe | null> => {
    const trimmed = workspaceId.trim();
    if (!trimmed) return null;
    const result = await postCustomerWorkspaceActivate(trimmed);
    if (!result.ok) {
      const err = new Error(result.error || 'Could not switch workspace.') as Error & { errorCode?: string };
      err.errorCode = result.errorCode;
      throw err;
    }
    setCustomer(result.data);
    const { needsOnboarding: need, bootstrapWarn } = await loadOnboardingFlags(result.data);
    if (bootstrapWarn) {
      setBootstrapError('Could not load assistants. You can retry from the Agents page.');
    }
    setNeedsOnboarding(need);
    return result.data;
  }, []);

  const applyCustomerSession = useCallback((next: CustomerMe) => {
    setCustomer(next);
  }, []);

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
      clearAllOnboardingLocalStorage();
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
      patchPrimaryWorkspaceOnboardingStatus,
      activateWorkspace,
      applyCustomerSession,
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
      patchPrimaryWorkspaceOnboardingStatus,
      activateWorkspace,
      applyCustomerSession,
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
