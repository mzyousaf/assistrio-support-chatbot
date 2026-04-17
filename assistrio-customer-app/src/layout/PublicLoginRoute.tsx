import type { ReactNode } from 'react';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { PostLoginRedirect } from '../routes/PostLoginRedirect';
import { PageLoader } from '../components/PageLoader';

export function PublicLoginRoute({ children }: { children: ReactNode }) {
  const { status, needsOnboarding } = useCustomerAuth();

  if (status === 'loading' || (status === 'authenticated' && needsOnboarding === null)) {
    return <PageLoader />;
  }

  if (status === 'authenticated') {
    return <PostLoginRedirect />;
  }

  return children;
}
