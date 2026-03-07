"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

function formatDate(value: unknown): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

type PageData = {
  visitor: {
    name?: string;
    email?: string;
    phone?: string;
    createdAt?: string | null;
    lastSeenAt?: string | null;
    showcaseMessageCount?: number;
    ownBotMessageCount?: number;
    [key: string]: unknown;
  };
  events: Array<{ _id: string; createdAt?: string | null; type?: string; path?: string; botSlug?: string }>;
  bots: Array<{ _id: string; name?: string; slug?: string; createdAt?: string | null }>;
  conversationsCount: number;
};

export default function VisitorDetailPage() {
  const params = useParams();
  const visitorId = typeof params?.visitorId === "string" ? params.visitorId : "";
  const { user, loading: authLoading } = useSuperAdmin();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !visitorId) return;
    let cancelled = false;
    apiFetch(`/api/super-admin/visitors/${encodeURIComponent(visitorId)}`)
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
  }, [user, visitorId]);

  if (authLoading || !user) {
    return (
      <AdminShell title="Visitor">
        <p className="text-sm text-gray-500">Loading…</p>
      </AdminShell>
    );
  }

  if (error || (!loading && !data)) {
    return (
      <AdminShell title="Visitor">
        <p className="text-sm text-gray-500 dark:text-gray-400">{error ?? "Visitor not found."}</p>
      </AdminShell>
    );
  }

  if (loading || !data) {
    return (
      <AdminShell title={`Visitor ${visitorId}`}>
        <p className="text-sm text-gray-500">Loading…</p>
      </AdminShell>
    );
  }

  const { visitor, events, bots, conversationsCount } = data;

  return (
    <AdminShell title={`Visitor ${visitorId}`}>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Profile">
          <dl className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
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

        <Card title="Usage">
          <dl className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Showcase messages</dt>
              <dd>{visitor.showcaseMessageCount ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Own bot messages</dt>
              <dd>{visitor.ownBotMessageCount ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Events tracked</dt>
              <dd>{events.length}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Conversations</dt>
              <dd>{conversationsCount}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-500">Owned bots</dt>
              <dd>{bots.length}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Notes">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You can use this page to qualify visitors who might become paying clients.
          </p>
        </Card>
      </div>

      <Card title="Owned bots">
        {bots.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">No bots created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="text-left py-2 pr-2">Name</th>
                  <th className="text-left py-2 pr-2">Created</th>
                  <th className="text-left py-2 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot) => (
                  <tr key={String(bot._id)} className="border-b border-gray-200 dark:border-gray-800">
                    <td className="py-2 pr-2">{bot.name}</td>
                    <td className="py-2 pr-2 text-gray-500 dark:text-gray-400 text-[11px]">
                      {formatDate(bot.createdAt)}
                    </td>
                    <td className="py-2 pr-2 text-gray-500 dark:text-gray-400 text-[11px]">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
