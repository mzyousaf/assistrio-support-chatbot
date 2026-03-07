"use client";

import AdminShell from "@/components/admin/AdminShell";
import NewBotDraftInitializer from "@/components/admin/NewBotDraftInitializer";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

export default function SuperAdminNewBotPage() {
  const { user, loading } = useSuperAdmin();

  if (loading || !user) {
    return (
      <AdminShell title="Create Bot">
        <p className="text-sm text-gray-500">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Create Bot">
      <section className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create Showcase Bot</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Initializing a draft bot and redirecting you to the full editor.
        </p>
      </section>

      <NewBotDraftInitializer />
    </AdminShell>
  );
}
