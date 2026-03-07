"use client";

import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/Card";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

export default function SuperAdminDashboardPage() {
  const { user, loading } = useSuperAdmin();

  if (loading || !user) {
    return (
      <AdminShell title="Dashboard">
        <p className="text-sm text-gray-500">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Dashboard">
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Welcome, {user.email}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Choose a section to manage the platform. Use the sidebar, breadcrumbs, or back button to move faster.
        </p>
      </Card>

      <Card title="Quick Links">
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            href="/super-admin/bots"
          >
            Manage Bots
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            href="/super-admin/visitors"
          >
            View Visitors
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            href="/super-admin/analytics"
          >
            Open Analytics
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            href="/super-admin/settings/limits"
          >
            Configure Limits
          </Link>
        </div>
      </Card>
    </AdminShell>
  );
}
