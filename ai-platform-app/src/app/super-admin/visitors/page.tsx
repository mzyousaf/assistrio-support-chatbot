import Link from "next/link";
import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/Card";

import { connectToDatabase } from "@/lib/mongoose";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Visitor } from "@/models/Visitor";

function formatDate(value: Date | null | undefined): string {
  if (!value) {
    return "-";
  }

  return value.toLocaleString();
}

export default async function SuperAdminVisitorsPage() {
  const user = await getAuthenticatedSuperAdmin();

  if (!user) {
    redirect("/super-admin/login");
  }

  await connectToDatabase();

  const visitors = await Visitor.find({})
    .sort({ lastSeenAt: -1 })
    .limit(100)
    .select({
      visitorId: 1,
      name: 1,
      email: 1,
      phone: 1,
      showcaseMessageCount: 1,
      ownBotMessageCount: 1,
      createdAt: 1,
      lastSeenAt: 1,
    })
    .lean();

  return (
    <AdminShell title="Visitors">
      <section className="space-y-1">
        <p className="text-sm text-gray-600 dark:text-gray-400">Showing most recent 100 visitors (by last seen).</p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Total shown: <span className="font-medium text-gray-700 dark:text-gray-300">{visitors.length}</span>
        </p>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Visitor ID</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Name</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Email</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Phone</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Showcase Count</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Own Bot Count</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Created At</th>
                <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-gray-800 dark:text-gray-200">
              {visitors.map((visitor) => (
                <tr key={visitor.visitorId} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/super-admin/visitors/${visitor.visitorId}`}
                      className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/15 hover:bg-brand-100 dark:hover:bg-brand-500/25 transition-colors"
                    >
                      {visitor.visitorId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{visitor.name || "-"}</td>
                  <td className="px-4 py-3">{visitor.email || "-"}</td>
                  <td className="px-4 py-3">{visitor.phone || "-"}</td>
                  <td className="px-4 py-3">{visitor.showcaseMessageCount}</td>
                  <td className="px-4 py-3">{visitor.ownBotMessageCount}</td>
                  <td className="px-4 py-3">{formatDate(visitor.createdAt)}</td>
                  <td className="px-4 py-3">{formatDate(visitor.lastSeenAt)}</td>
                </tr>
              ))}
              {visitors.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={8}>
                    No visitors found yet.
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
