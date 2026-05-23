import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { PageLoader } from '../components/PageLoader';
import { GoLivePublishOverlayProvider } from '../onboarding/goLivePublishOverlay';
import {
  AUTH_BOOTSTRAP_LOADER_TITLE,
  CUSTOMER_ROUTES,
  isCustomerAuthBootstrapPending,
} from '../routes/customerRoutes';

/** Requires a valid customer session; renders `<Outlet />` for nested protected routes. */
export function ProtectedRoute() {
  const { status, needsOnboarding } = useCustomerAuth();
  const location = useLocation();

  if (isCustomerAuthBootstrapPending(status, needsOnboarding)) {
    return <PageLoader title={AUTH_BOOTSTRAP_LOADER_TITLE} />;
  }

  if (status === 'anonymous') {
    return <Navigate to={CUSTOMER_ROUTES.login} replace state={{ from: location.pathname }} />;
  }

  return (
    <GoLivePublishOverlayProvider>
      <Outlet />
    </GoLivePublishOverlayProvider>
  );
}
