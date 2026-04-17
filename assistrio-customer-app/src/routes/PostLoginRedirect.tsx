import { Navigate } from 'react-router-dom';
import { useCustomerAuth } from '../auth/CustomerAuthContext';

/** Uses the same heuristic as backend OAuth redirect: zero assistants ⇒ onboarding. */
export function PostLoginRedirect() {
  const { needsOnboarding } = useCustomerAuth();
  if (needsOnboarding === true) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Navigate to="/bots" replace />;
}
