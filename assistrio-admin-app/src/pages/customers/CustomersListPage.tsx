import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Contact, Search } from 'lucide-react';
import { getAdminCustomers } from '@/api/adminApi';
import type { AdminCustomerListItem, AdminPagination } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataPageLayout } from '@/layout/workspace-layout';
import { formatAdminDateTime } from '@/lib/formatAdminDate';

function CustomerAvatar({ customer }: { customer: AdminCustomerListItem }) {
  const initial = (customer.name?.[0] ?? customer.email?.[0] ?? '?').toUpperCase();
  if (customer.avatarUrl) {
    return (
      <img
        src={customer.avatarUrl}
        alt=""
        className="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
      />
    );
  }
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--teal-100)] text-[0.8125rem] font-semibold text-[var(--teal-800)] ring-1 ring-slate-200"
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function CustomersListPage() {
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<AdminCustomerListItem[] | null>(null);
  const [pagination, setPagination] = useState<AdminPagination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getAdminCustomers({ q: q || undefined, page, limit: 20 });
    setLoading(false);
    if (res.ok) {
      setCustomers(res.data.customers);
      setPagination(res.data.pagination);
      return;
    }
    setCustomers(null);
    setPagination(null);
    setError(res.error);
  }, [q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const totalPages = pagination?.totalPages ?? 0;

  return (
    <DataPageLayout
      title="Customers"
      description="Platform customer accounts, their workspaces, and bots."
      containerSize="full"
    >
      <div className="mb-6 max-w-md">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search by name or email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            aria-label="Search customers"
          />
        </div>
      </div>

      {error ? (
        <div
          className="mb-5 rounded-[0.625rem] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-[0.85rem] text-[0.875rem] text-[var(--color-danger-text-emphasis)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading && !customers ? (
        <p className="text-sm text-slate-500">Loading customers…</p>
      ) : null}

      {!loading && customers && customers.length === 0 ? (
        <div
          className="rounded-2xl bg-white px-6 py-14 text-center shadow-[var(--shadow-card)]"
          style={{ border: '1px dashed var(--border-soft)' }}
        >
          <div className="mb-4 flex justify-center text-slate-300">
            <Contact size={44} strokeWidth={1.5} />
          </div>
          <h2 className="mb-2 mt-0 text-[1.125rem] font-semibold tracking-tight text-slate-900">
            No customers found
          </h2>
          <p className="mx-auto max-w-[28rem] text-[0.9375rem] leading-[1.55] text-slate-400">
            {q ? 'Try a different search term.' : 'No customer accounts exist yet.'}
          </p>
        </div>
      ) : null}

      {customers && customers.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[56rem] border-collapse text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[0.75rem] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-right">Workspaces</th>
                  <th className="px-4 py-3 text-right">Bots</th>
                  <th className="px-4 py-3 text-right">Published</th>
                  <th className="px-4 py-3 text-right">Draft</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Last active</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CustomerAvatar customer={c} />
                        <span className="font-medium text-slate-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.email}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.workspaceCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.botCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.publishedBotCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.draftBotCount}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatAdminDateTime(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatAdminDateTime(c.lastActiveAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/customers/${c.id}`}
                        className="font-semibold text-primary no-underline hover:text-[var(--teal-800)] hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && totalPages > 1 ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-[0.8125rem] text-slate-500">
                Page {pagination.page} of {totalPages} · {pagination.total} customers
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </DataPageLayout>
  );
}
