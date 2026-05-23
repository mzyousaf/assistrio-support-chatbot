import { Navigate, Outlet } from 'react-router-dom';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { PageLoader } from '../components/PageLoader';
import {
  AUTH_BOOTSTRAP_LOADER_TITLE,
  CUSTOMER_ROUTES,
  isCustomerAuthBootstrapPending,
} from '../routes/customerRoutes';

/**
 * Guards private dashboard routes (AppShell). Users who still need first-time
 * onboarding are sent to the onboarding flow.
 *
 * TODO(epic-3b-invite): Invited workspace members should bypass this guard and
 * land in their invited workspace dashboard without completing owner onboarding.
 */
export function OnboardingCompleteRoute() {
  const { status, needsOnboarding } = useCustomerAuth();

  if (isCustomerAuthBootstrapPending(status, needsOnboarding)) {
    return <PageLoader title={AUTH_BOOTSTRAP_LOADER_TITLE} />;
  }

  if (needsOnboarding) {
    return <Navigate to={CUSTOMER_ROUTES.onboarding} replace />;
  }

  return <Outlet />;
}
