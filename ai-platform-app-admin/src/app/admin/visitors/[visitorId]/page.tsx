"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/Card";
import { VisitorDetailPageSkeleton } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";
import { useAdminUser } from "@/hooks/useAdminUser";

function formatDate(value: unknown): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

type PageData = {
  visitor: {
    visitorId?: string;
    name?: string;
    email?: string;
    phone?: string;
    previewUserMessageCount?: number;
    createdAt?: string | null;
    lastSeenAt?: string | null;
    [key: string]: unknown;
  };
  events: Array<{ _id: string; createdAt?: string | null; type?: string; path?: string; botSlug?: string }>;
};

export default function VisitorDetailPage() {
  const params = useParams();
  const visitorIdParam = typeof params?.visitorId === "string" ? params.visitorId : "";
  const { user, loading: authLoading } = useAdminUser();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !visitorIdParam) return;
    let cancelled = false;
    apiFetch(`/api/user/visitors/${encodeURIComponent(visitorIdParam)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError("Visitor not found.");
          return;
        }
        const json = (await res.json()) as PageData;
        setData(json);
      })
      .catch(() => setError("Failed to load visitor."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, visitorIdParam]);

  if (authLoading || !user) {
    return (
      <AdminShell title="Marketing visitor">
        <VisitorDetailPageSkeleton />
      </AdminShell>
    );
  }

  if (error || (!loading && !data)) {
    return (
      <AdminShell title="Marketing visitor">
        <p className="text-sm text-gray-500 dark:text-gray-400">{error ?? "Visitor not found."}</p>
      </AdminShell>
    );
  }

  if (loading || !data) {
    return (
      <AdminShell title={`Marketing visitor ${visitorIdParam}`}>
        <VisitorDetailPageSkeleton />
      </AdminShell>
    );
  }

  const { visitor, events } = data;
  const vid = String(visitor.visitorId ?? visitorIdParam);

  return (
    <AdminShell title={`Marketing visitor ${vid}`}>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Profile">
          <dl className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Visitor id</dt>
              <dd className="font-mono text-[11px] break-all">{vid}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Name</dt>
              <dd>{visitor.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Email</dt>
              <dd>{visitor.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Phone</dt>
              <dd>{visitor.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Created</dt>
              <dd>{formatDate(visitor.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Last seen</dt>
              <dd>{formatDate(visitor.lastSeenAt)}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Activity summary">
          <dl className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Events tracked</dt>
              <dd>{events.length}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Notes">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Bots are owned by workspace accounts only; this row is for marketing analytics continuity.
          </p>
        </Card>
      </div>

      <Card title="Recent activity">
        {events.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">No events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="text-left py-2 pr-2">Time</th>
                  <th className="text-left py-2 pr-2">Type</th>
                  <th className="text-left py-2 pr-2">Path</th>
                  <th className="text-left py-2 pr-2">Bot</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev._id.toString()} className="border-b border-gray-200 dark:border-gray-800">
                    <td className="py-2 pr-2 text-[11px] text-gray-500 dark:text-gray-400">{formatDate(ev.createdAt)}</td>
                    <td className="py-2 pr-2">{ev.type}</td>
                    <td className="py-2 pr-2 text-[11px] text-gray-500 dark:text-gray-400">{ev.path ?? "—"}</td>
                    <td className="py-2 pr-2 text-[11px] text-gray-500 dark:text-gray-400">{ev.botSlug ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
