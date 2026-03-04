import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import NewBotDraftInitializer from "@/components/admin/NewBotDraftInitializer";
import { connectToDatabase } from "@/lib/mongoose";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";

export default async function SuperAdminNewBotPage() {
  const admin = await getAuthenticatedSuperAdmin();

  if (!admin) {
    redirect("/super-admin/login");
  }

  await connectToDatabase();

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
