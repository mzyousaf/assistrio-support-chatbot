import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerAuth } from './CustomerAuthContext';
import { CUSTOMER_ROUTES } from '../routes/customerRoutes';

type SignOutOptions = {
  /** Run before navigation (e.g. close open menus). */
  beforeNavigate?: () => void;
};

/**
 * Shared customer sign-out: backend logout attempt, always clear local auth state, then `/login?selectAccount=1`.
 */
export function useCustomerLogout() {
  const navigate = useNavigate();
  const { logout, logoutInFlight, logoutError, clearLogoutError } = useCustomerAuth();

  const signOut = useCallback(
    async (options?: SignOutOptions) => {
      options?.beforeNavigate?.();
      await logout();
      navigate(`${CUSTOMER_ROUTES.login}?selectAccount=1`, { replace: true });
    },
    [logout, navigate],
  );

  return { signOut, logoutInFlight, logoutError, clearLogoutError };
}
