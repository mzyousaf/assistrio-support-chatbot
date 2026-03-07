"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString();
}

type VisitorRow = {
  visitorId: string;
  name?: string;
  email?: string;
  phone?: string;
  showcaseMessageCount?: number;
  ownBotMessageCount?: number;
  createdAt?: string | null;
  lastSeenAt?: string | null;
};

export default function SuperAdminVisitorsPage() {
  const { user, loading: authLoading } = useSuperAdmin();
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch("/api/super-admin/visitors")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError("Failed to load visitors.");
          return;
        }
        const raw = (await res.json()) as unknown[];
        const all = (raw ?? []) as VisitorRow[];
        const sorted = [...all]
          .sort((a, b) => new Date(b.lastSeenAt ?? 0).getTime() - new Date(a.lastSeenAt ?? 0).getTime())
          .slice(0, 100);
        setVisitors(sorted);
      })
      .catch(() => setError("Failed to load visitors."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || !user) {
    return (
      <AdminShell title="Visitors">
        <p className="text-sm text-gray-500">Loading…</p>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell title="Visitors">
        <p className="text-sm text-red-600">{error}</p>
      </AdminShell>
    );
  }

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
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={8}>Loading…</td>
                </tr>
              ) : (
                <>
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
                  {visitors.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={8}>
                        No visitors found yet.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
