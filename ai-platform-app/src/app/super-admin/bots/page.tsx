"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import CreateNewBotButton from "@/components/admin/CreateNewBotButton";
import { SettingsModal } from "@/components/admin/settings/SettingsModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString();
}

type BotRow = {
  _id: string;
  name: string;
  type: string;
  category: string;
  status: string;
  isPublic: boolean;
  createdAt: string | null;
  slug?: string;
};

export default function SuperAdminBotsPage() {
  const { user, loading: authLoading } = useSuperAdmin();
  const searchParams = useSearchParams();
  const statusFilter = searchParams?.get("status") === "draft" || searchParams?.get("status") === "published"
    ? searchParams.get("status")
    : "all";
  const [bots, setBots] = useState<BotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [botToDelete, setBotToDelete] = useState<{ id: string; name: string } | null>(null);

  async function fetchBots() {
    const url = `/api/super-admin/bots${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`;
    const res = await apiFetch(url);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setApiError(data.error ?? "Failed to load bots.");
      return;
    }
    const data = await res.json();
    setBots(Array.isArray(data) ? data : []);
    setApiError(null);
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const url = `/api/super-admin/bots${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`;
    apiFetch(url)
      .then(async (res) => {
        if (cancelled) return;
        const data = (await res.json().catch(() => ({}))) as { error?: string } | BotRow[];
        if (!res.ok) {
          setApiError((data as { error?: string })?.error ?? "Failed to load bots.");
          return;
        }
        setBots(Array.isArray(data) ? data : []);
        setApiError(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, statusFilter]);

  async function confirmDelete() {
    if (!botToDelete) return;
    setDeletingId(botToDelete.id);
    setApiError(null);
    try {
      const res = await apiFetch(`/api/super-admin/bots/${botToDelete.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setApiError(data.error ?? "Failed to delete bot.");
        return;
      }
      setBotToDelete(null);
      await fetchBots();
    } catch {
      setApiError("Failed to delete bot. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading || !user) {
    return (
      <AdminShell title="Bots">
        <p className="text-sm text-gray-500">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Bots">
      {apiError ? (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
          role="alert"
        >
          <span>{apiError}</span>
          <button
            type="button"
            onClick={() => setApiError(null)}
            className="shrink-0 rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/40"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <SettingsModal
        open={botToDelete !== null}
        onClose={() => !deletingId && setBotToDelete(null)}
        title="Delete bot?"
        description={botToDelete ? `"${botToDelete.name}" will be permanently deleted. This cannot be undone.` : undefined}
        maxWidthClass="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBotToDelete(null)}
              disabled={!!deletingId}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void confirmDelete()}
              disabled={!!deletingId}
            >
              {deletingId ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete this bot? All associated documents and data will be removed.
        </p>
      </SettingsModal>
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage and review all configured bots.</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            Total bots:{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">{bots.length}</span>
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
          label="Create new"
          className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-400"
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
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={7}>Loading…</td>
                </tr>
              ) : (
                <>
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
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/super-admin/bots/${String(bot._id)}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                              title="Edit bot"
                              aria-label="Edit bot"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setBotToDelete({ id: String(bot._id), name: bot.name })}
                              disabled={deletingId === bot._id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
                              title="Delete bot"
                              aria-label="Delete bot"
                            >
                              {deletingId === bot._id ? (
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {bots.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={7}>
                        No bots found yet.
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
