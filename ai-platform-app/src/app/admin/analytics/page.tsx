"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";
import { useAdminUser } from "@/hooks/useAdminUser";

type MetricCardProps = { label: string; value: number };

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

type EventRow = {
  _id: string;
  visitorId?: string | null;
  type?: string;
  path?: string;
  botSlug?: string;
  createdAt?: string | null;
};

export default function AdminAnalyticsPage() {
  const { user, loading: authLoading } = useAdminUser();
  const [metrics, setMetrics] = useState<Array<{ label: string; value: number }>>([]);
  const [recentEvents, setRecentEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch("/api/user/analytics")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError("Failed to load analytics.");
          return;
        }
        const data = (await res.json()) as {
          metrics?: Array<{ label: string; value: number }>;
          recentEvents?: EventRow[];
        };
        setMetrics(data?.metrics ?? []);
        setRecentEvents(data?.recentEvents ?? []);
      })
      .catch(() => setError("Failed to load analytics."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user) {
    return (
      <AdminShell title="Analytics">
        <p className="text-sm text-gray-500">Loading…</p>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell title="Analytics">
        <p className="text-sm text-red-600">{error}</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Analytics">
      <section className="space-y-1">
        <p className="text-sm text-gray-600 dark:text-gray-400">High-level overview of traffic and engagement.</p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Showing latest <span className="font-medium text-gray-700 dark:text-gray-300">{recentEvents.length}</span>{" "}
          events.
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((metric, i) => (
              <MetricCard key={i} label={metric.label} value={metric.value} />
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
                        <td className="px-4 py-3">{event.visitorId ?? "-"}</td>
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
        </>
      )}
    </AdminShell>
  );
}
