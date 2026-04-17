"use client";

import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/Card";
import { DashboardPageSkeleton } from "@/components/ui/Skeleton";
import { useAdminUser } from "@/hooks/useAdminUser";

export default function AdminDashboardPage() {
  const { user, loading } = useAdminUser();

  if (loading || !user) {
    return (
      <AdminShell title="Overview" subtitle="Internal operator home — shortcuts to bots, visitors, analytics, and settings.">
        <DashboardPageSkeleton />
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Overview" subtitle="Internal operator home — shortcuts to bots, visitors, analytics, and settings.">
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Signed in, {user.email}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Use the sidebar for bots, global analytics, visitors, and platform settings.
        </p>
      </Card>

      <Card title="Quick Links">
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            href="/admin/bots"
          >
            Bots &amp; showcase
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            href="/admin/visitors"
          >
            Visitors
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            href="/admin/analytics"
          >
            Global analytics
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-300 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            href="/admin/settings/general"
          >
            Platform settings
          </Link>
        </div>
      </Card>
    </AdminShell>
  );
}
