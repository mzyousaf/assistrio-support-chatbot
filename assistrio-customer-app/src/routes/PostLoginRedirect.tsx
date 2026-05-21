import { Navigate } from 'react-router-dom';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { PageLoader } from '../components/PageLoader';
import {
  AUTH_BOOTSTRAP_LOADER_TITLE,
  CUSTOMER_POST_LOGIN_DEST,
  CUSTOMER_ROUTES,
} from './customerRoutes';

/**
 * Default destination after sign-in (same client heuristic as backend OAuth redirect).
 * Full blocking onboarding is deferred to the onboarding epic.
 */
export function PostLoginRedirect() {
  const { needsOnboarding } = useCustomerAuth();

  if (needsOnboarding === null) {
    return <PageLoader title={AUTH_BOOTSTRAP_LOADER_TITLE} />;
  }

  if (needsOnboarding) {
    return <Navigate to={CUSTOMER_ROUTES.onboarding} replace />;
  }

  return <Navigate to={CUSTOMER_POST_LOGIN_DEST} replace />;
}
