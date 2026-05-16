import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { PageLoader } from '../components/PageLoader';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, needsOnboarding } = useCustomerAuth();
  const location = useLocation();

  if (status === 'loading' || (status === 'authenticated' && needsOnboarding === null)) {
    return <PageLoader title="Loading your account…" />;
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
