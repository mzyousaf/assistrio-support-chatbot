import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BarChart3, Bot, LayoutDashboard, Layers } from 'lucide-react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { getAdminCustomer } from '@/api/adminApi';
import type { AdminCustomerDetail } from '@/api/types';
import { InlineLoader } from '@/components/PageLoader';
import { WorkspaceLoadFailureCard } from '@/components/WorkspaceLoadFailureCard';
import { ContextualAreaLayout } from '@/layout/ContextualAreaLayout';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';

export type CustomerDetailOutletContext = {
  customer: AdminCustomerDetail;
  reload: () => Promise<void>;
};

export function CustomerDetailLayout() {
  const { customerId = '' } = useParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [loadMessage, setLoadMessage] = useState('');

  const reload = useCallback(async () => {
    if (!customerId) return;
    setLoadState('loading');
    const res = await getAdminCustomer(customerId);
    if (res.ok) {
      setCustomer(res.data.customer);
      setLoadState('ok');
      setLoadMessage('');
      return;
    }
    setCustomer(null);
    setLoadState('error');
    setLoadMessage(res.error);
  }, [customerId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const navItems = [
    { to: `/customers/${customerId}`, label: 'Overview', icon: LayoutDashboard, end: true },
    { to: `/customers/${customerId}/workspaces`, label: 'Workspaces', icon: Layers, end: true },
    { to: `/customers/${customerId}/bots`, label: 'Bots', icon: Bot, end: true },
    { to: `/customers/${customerId}/analytics`, label: 'Customer analytics', icon: BarChart3, end: true },
  ];

  if (!customerId) {
    return (
      <WorkspaceContentContainer>
        <p className="text-sm text-slate-500">Missing customer id.</p>
      </WorkspaceContentContainer>
    );
  }

  if (loadState === 'loading') {
    return (
      <WorkspaceContentContainer size="full">
        <div className="flex min-h-[40vh] items-center justify-center">
          <InlineLoader title="Loading customer…" />
        </div>
      </WorkspaceContentContainer>
    );
  }

  if (loadState !== 'ok' || !customer) {
    return (
      <WorkspaceContentContainer size="full">
        <div className="flex min-h-[40vh] flex-col items-center justify-center">
          <WorkspaceLoadFailureCard
            icon="not_found"
            title="Customer not found"
            description={loadMessage || 'Could not load this customer.'}
            onPrimary={() => void reload()}
            secondary={{ to: '/customers', label: 'Back to customers' }}
          />
        </div>
      </WorkspaceContentContainer>
    );
  }

  return (
    <ContextualAreaLayout
      title={customer.name}
      subtitle={customer.email}
      navItems={navItems}
      mobileAriaLabel="Customer sections"
      showSecondary
    >
      <div className="mb-6">
        <NavLink
          to="/customers"
          className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-slate-500 no-underline hover:text-primary"
        >
          <ArrowLeft size={15} aria-hidden />
          All customers
        </NavLink>
        <div className="flex flex-wrap items-center gap-3 lg:hidden">
          {customer.avatarUrl ? (
            <img
              src={customer.avatarUrl}
              alt=""
              className="size-11 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <span className="flex size-11 items-center justify-center rounded-full bg-[var(--teal-100)] text-sm font-semibold text-[var(--teal-800)]">
              {(customer.name[0] ?? '?').toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="m-0 text-lg font-semibold tracking-tight text-slate-900">{customer.name}</h1>
            <p className="mt-0.5 m-0 text-sm text-slate-500">{customer.email}</p>
          </div>
        </div>
      </div>
      <Outlet context={{ customer, reload } satisfies CustomerDetailOutletContext} />
    </ContextualAreaLayout>
  );
}
