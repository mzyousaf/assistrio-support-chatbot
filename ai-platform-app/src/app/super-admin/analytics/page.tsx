import { redirect } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/Card";

import { connectToDatabase } from "@/lib/mongoose";
import { getAuthenticatedSuperAdmin } from "@/lib/superAdminAuth";
import { Bot } from "@/models/Bot";
import { Visitor } from "@/models/Visitor";
import { VisitorEvent } from "@/models/VisitorEvent";

type MetricCardProps = {
  label: string;
  value: number;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <Card className="rounded-xl p-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
    </Card>
  );
}

function formatEventTime(value: unknown): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default async function SuperAdminAnalyticsPage() {
  const admin = await getAuthenticatedSuperAdmin();

  if (!admin) {
    redirect("/super-admin/login");
  }

  await connectToDatabase();

  const [
    totalVisitors,
    totalPageViews,
    trialBotsCreated,
    demoChatsStarted,
    trialChatsStarted,
    showcaseBots,
    visitorOwnedBots,
  ] = await Promise.all([
    Visitor.countDocuments(),
    VisitorEvent.countDocuments({ type: "page_view" }),
    VisitorEvent.countDocuments({ type: "trial_bot_created" }),
    VisitorEvent.countDocuments({ type: "demo_chat_started" }),
    VisitorEvent.countDocuments({ type: "trial_chat_started" }),
    Bot.countDocuments({ type: "showcase" }),
    Bot.countDocuments({ type: "visitor-own" }),
  ]);

  const metrics = [
    { label: "Total Visitors", value: totalVisitors },
    { label: "Total Page Views", value: totalPageViews },
    { label: "Trial Bots Created", value: trialBotsCreated },
    { label: "Demo Chats Started", value: demoChatsStarted },
    { label: "Trial Chats Started", value: trialChatsStarted },
    { label: "Showcase Bots", value: showcaseBots },
    { label: "Visitor-Owned Bots", value: visitorOwnedBots },
  ];
  const recentEvents = await VisitorEvent.find({})
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return (
    <AdminShell title="Analytics">
      <section className="space-y-1">
        <p className="text-sm text-gray-600 dark:text-gray-400">High-level overview of traffic and engagement.</p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Showing latest <span className="font-medium text-gray-700 dark:text-gray-300">{recentEvents.length}</span>{" "}
          events.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Events</h2>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Time</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Visitor ID</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Type</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Path</th>
                  <th className="px-4 py-3 font-medium uppercase tracking-wide text-xs">Bot Slug</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-gray-800 dark:text-gray-200">
                {recentEvents.map((event) => (
                  <tr key={String(event._id)} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">{formatEventTime(event.createdAt)}</td>
                    <td className="px-4 py-3">{event.visitorId || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                        {event.type || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{event.path || "-"}</td>
                    <td className="px-4 py-3">{event.botSlug || "-"}</td>
                  </tr>
                ))}
                {recentEvents.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={5}>
                      No recent events found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}
