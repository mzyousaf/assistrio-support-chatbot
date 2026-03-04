import Link from "next/link";
import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import CreateNewBotButton from "@/components/admin/CreateNewBotButton";
import { Card } from "@/components/ui/Card";

import { connectToDatabase } from "@/lib/mongoose";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Bot } from "@/models/Bot";

function formatDate(value: Date | null | undefined): string {
  if (!value) {
    return "-";
  }

  return value.toLocaleString();
}

type BotsPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function SuperAdminBotsPage({ searchParams }: BotsPageProps) {
  const admin = await getAuthenticatedSuperAdmin();

  if (!admin) {
    redirect("/super-admin/login");
  }

  await connectToDatabase();

  const params = (await searchParams) ?? {};
  const statusFilter = params.status === "draft" || params.status === "published" ? params.status : "all";

  const query: { status?: "draft" | "published" } = {};
  if (statusFilter !== "all") {
    query.status = statusFilter;
  }

  const bots = await Bot.find(query)
    .sort({ createdAt: -1 })
    .select({
      name: 1,
      type: 1,
      category: 1,
      status: 1,
      isPublic: 1,
      createdAt: 1,
    })
    .lean();

  return (
    <AdminShell title="Bots">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage and review all configured bots.</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            Total bots:{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {bots.length}
            </span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Link
              href="/super-admin/bots"
              className={`rounded-full border px-3 py-1 text-xs ${
                statusFilter === "all"
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            >
              All
            </Link>
            <Link
              href="/super-admin/bots?status=draft"
              className={`rounded-full border px-3 py-1 text-xs ${
                statusFilter === "draft"
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            >
              Draft
            </Link>
            <Link
              href="/super-admin/bots?status=published"
              className={`rounded-full border px-3 py-1 text-xs ${
                statusFilter === "published"
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600"
              }`}
            >
              Published
            </Link>
          </div>
        </div>
        <CreateNewBotButton
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white shadow-card transition hover:bg-brand-400"
          label="Create new bot"
        />
      </section>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Name</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Type</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Category</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Status</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Visibility</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Created At</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-gray-800 dark:text-gray-200">
              {bots.map((bot) => (
                <tr key={String(bot._id)} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{bot.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                      {bot.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">{bot.category || "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        bot.status === "published"
                          ? "inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
                          : "inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                      }
                    >
                      {bot.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        bot.isPublic
                          ? "inline-flex items-center rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                          : "inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300"
                      }
                    >
                      {bot.isPublic ? "Public" : "Private"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDate(bot.createdAt)}</td>
                  <td className="px-4 py-3">
                    {bot.type === "showcase" ? (
                      <Link
                        className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-brand-500 hover:bg-brand-400 text-white transition-colors"
                        href={`/super-admin/bots/${String(bot._id)}`}
                      >
                        Edit
                      </Link>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {bots.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={7}>
                    No bots found yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
