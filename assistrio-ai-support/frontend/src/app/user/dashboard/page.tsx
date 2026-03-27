"use client";

import Link from "next/link";
import { LayoutGrid, MessageSquare } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/Card";
import { useUser } from "@/hooks/useUser";

export default function UserDashboardPage() {
  const { user, loading } = useUser();

  if (loading || !user) {
    return (
      <AdminShell title="Dashboard">
        <p className="text-sm text-gray-500">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Dashboard">
      <Card className="border-gray-200/80 bg-white shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Welcome back
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Signed in as <span className="font-medium text-gray-800 dark:text-gray-200">{user.email}</span>
        </p>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Build and train AI agents on your content — similar to Chatbase: connect data, customize the widget, and deploy to your site.
        </p>
      </Card>

      <Card title="Get started" className="border-gray-200/80 bg-white shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500/40"
            href="/user/bots"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <MessageSquare className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                Bots
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                Create, publish, and embed your assistants.
              </span>
            </span>
          </Link>
          <Link
            className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500/40"
            href="/user/bots/new"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <LayoutGrid className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                New bot
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                Start from a draft and open the full editor.
              </span>
            </span>
          </Link>
        </div>
      </Card>
    </AdminShell>
  );
}
