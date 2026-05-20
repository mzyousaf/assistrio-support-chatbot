import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../auth/AdminAuthContext';
import { PageLoader } from '../components/PageLoader';

export function PublicLoginRoute({ children }: { children: ReactNode }) {
  const { status } = useAdminAuth();

  if (status === 'loading') {
    return <PageLoader title="Loading…" />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/customers" replace />;
  }

  return children;
}
