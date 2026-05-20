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
  registerAdminSessionUnauthorizedGate,
  unregisterAdminSessionUnauthorizedGate,
} from '../api/adminSessionUnauthorized';
import { getAdminMe, logoutAdmin } from '../api/adminApi';
import type { AdminMe } from '../api/types';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export type AdminAuthValue = {
  status: AuthStatus;
  sessionInvalidatedByApi: boolean;
  admin: AdminMe | null;
  bootstrapError: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<boolean>;
  logoutInFlight: boolean;
  logoutError: string | null;
  clearLogoutError: () => void;
  clearSessionInvalidatedByApi: () => void;
};

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [logoutInFlight, setLogoutInFlight] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [sessionInvalidatedByApi, setSessionInvalidatedByApi] = useState(false);

  const statusRef = useRef<AuthStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useLayoutEffect(() => {
    registerAdminSessionUnauthorizedGate(
      () => statusRef.current === 'authenticated',
      () => {
        setSessionInvalidatedByApi(true);
        setAdmin(null);
        setStatus('anonymous');
        setBootstrapError(null);
        setLogoutInFlight(false);
        setLogoutError(null);
      },
    );
    return () => unregisterAdminSessionUnauthorizedGate();
  }, []);

  const clearSessionInvalidatedByApi = useCallback(() => setSessionInvalidatedByApi(false), []);

  const refresh = useCallback(async () => {
    setBootstrapError(null);
    setSessionInvalidatedByApi(false);
    setStatus('loading');
    const me = await getAdminMe();
    if (me.ok) {
      setAdmin(me.data);
      setStatus('authenticated');
      return;
    }
    if (me.status === 401 || me.status === 403) {
      setAdmin(null);
      setStatus('anonymous');
      return;
    }
    setAdmin(null);
    setStatus('anonymous');
    setBootstrapError(me.error);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearLogoutError = useCallback(() => setLogoutError(null), []);

  const logout = useCallback(async (): Promise<boolean> => {
    setLogoutError(null);
    setLogoutInFlight(true);
    const res = await logoutAdmin();
    if (!res.ok) {
      setLogoutInFlight(false);
      setLogoutError(
        res.status === 0
          ? 'Could not reach the server. Check your connection and try signing out again.'
          : 'Could not sign out. Please try again.',
      );
      return false;
    }
    setAdmin(null);
    setStatus('anonymous');
    setBootstrapError(null);
    setSessionInvalidatedByApi(false);
    setLogoutInFlight(false);
    return true;
  }, []);

  const value = useMemo(
    () => ({
      status,
      sessionInvalidatedByApi,
      admin,
      bootstrapError,
      refresh,
      logout,
      logoutInFlight,
      logoutError,
      clearLogoutError,
      clearSessionInvalidatedByApi,
    }),
    [
      status,
      sessionInvalidatedByApi,
      admin,
      bootstrapError,
      refresh,
      logout,
      logoutInFlight,
      logoutError,
      clearLogoutError,
      clearSessionInvalidatedByApi,
    ],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return ctx;
}
