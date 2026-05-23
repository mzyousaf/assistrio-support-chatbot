import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../../auth/CustomerAuthContext';
import { OnboardingFlowProvider } from '../../onboarding/OnboardingFlowContext';
import { OnboardingStepUiProvider } from '../../onboarding/OnboardingStepUiContext';
import { PageLoader } from '../../components/PageLoader';
import { AUTH_BOOTSTRAP_LOADER_TITLE, CUSTOMER_ROUTES } from '../../routes/customerRoutes';

/** Avoid mounting the draft lifecycle when the user has finished first-time setup. */
export function OnboardingGate() {
  const { status, needsOnboarding } = useCustomerAuth();
  const { pathname } = useLocation();

  if (status === 'loading' || needsOnboarding === null) {
    return <PageLoader title={AUTH_BOOTSTRAP_LOADER_TITLE} />;
  }

  if (needsOnboarding === false && !pathname.startsWith(CUSTOMER_ROUTES.onboarding)) {
    return <Navigate to={CUSTOMER_ROUTES.agents} replace />;
  }

  return (
    <OnboardingFlowProvider>
      <OnboardingStepUiProvider>
        <Outlet />
      </OnboardingStepUiProvider>
    </OnboardingFlowProvider>
  );
}
