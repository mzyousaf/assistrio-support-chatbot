import type { ReactNode } from 'react';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { PostLoginRedirect } from '../routes/PostLoginRedirect';
import { PageLoader } from '../components/PageLoader';
import {
  AUTH_BOOTSTRAP_LOADER_TITLE,
  isCustomerAuthBootstrapPending,
} from '../routes/customerRoutes';

export function PublicLoginRoute({ children }: { children: ReactNode }) {
  const { status, needsOnboarding } = useCustomerAuth();

  if (isCustomerAuthBootstrapPending(status, needsOnboarding)) {
    return <PageLoader title={AUTH_BOOTSTRAP_LOADER_TITLE} />;
  }

  if (status === 'authenticated') {
    return <PostLoginRedirect />;
  }

  return children;
}
