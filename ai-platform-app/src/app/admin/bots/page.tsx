"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import {
  ADMIN_PAGE_META_TEXT_CLASS,
  ADMIN_PAGE_SEARCH_INPUT_CLASS,
  adminFilterChipClass,
} from "@/components/admin/admin-page-classes";
import CreateNewBotButton from "@/components/admin/CreateNewBotButton";
import { SettingsModal } from "@/components/admin/settings/SettingsModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonDataTable, SkeletonTableRows } from "@/components/ui/Skeleton";
import { apiFetch } from "@/lib/api";
import { useAdminUser } from "@/hooks/useAdminUser";

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

function AdminBotsContent() {
  const { user, loading: authLoading } = useAdminUser();
  const searchParams = useSearchParams();
  const statusFilter = searchParams?.get("status") === "draft" || searchParams?.get("status") === "published"
    ? searchParams.get("status")
    : "all";
  const [bots, setBots] = useState<BotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [botToDelete, setBotToDelete] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");

  const filteredBots = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bots;
    return bots.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.category ?? "").toLowerCase().includes(q) ||
        (b.type ?? "").toLowerCase().includes(q),
    );
  }, [bots, search]);

  async function fetchBots() {
    const url = `/api/user/bots${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`;
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
    const url = `/api/user/bots${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`;
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
      const res = await apiFetch(`/api/user/bots/${botToDelete.id}`, { method: "DELETE" });
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
      <AdminShell
        title="Agents"
        subtitle="Review and manage agents across the workspace."
      >
        <SkeletonDataTable rows={8} cols={7} />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Agents"
      subtitle="Review and manage agents across the workspace."
      actions={
        <CreateNewBotButton
          label="Create new agent"
          className="shrink-0 rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
        />
      }
      toolbar={
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-md">
            <label htmlFor="admin-agent-search" className="sr-only">
              Search agents
            </label>
            <input
              id="admin-agent-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, category, or type…"
              className={ADMIN_PAGE_SEARCH_INPUT_CLASS}
            />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <p className={ADMIN_PAGE_META_TEXT_CLASS}>
              Showing{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{filteredBots.length}</span> of{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{bots.length}</span> agents
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin/bots" className={adminFilterChipClass(statusFilter === "all")}>
                All
              </Link>
              <Link href="/admin/bots?status=draft" className={adminFilterChipClass(statusFilter === "draft")}>
                Draft
              </Link>
              <Link
                href="/admin/bots?status=published"
                className={adminFilterChipClass(statusFilter === "published")}
              >
                Published
              </Link>
            </div>
          </div>
        </>
      }
    >
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
                <SkeletonTableRows rows={6} cols={7} />
              ) : (
                <>
                  {filteredBots.map((bot) => (
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
                              href={`/admin/bots/${String(bot._id)}/playground/profile`}
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
                  {filteredBots.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={7}>
                        {bots.length === 0 ? "No agents yet." : "No agents match your search or filters."}
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

export default function AdminBotsPage() {
  return (
    <Suspense
      fallback={
        <AdminShell title="Agents" subtitle="Review and manage agents across the workspace.">
          <SkeletonDataTable rows={8} cols={7} />
        </AdminShell>
      }
    >
      <AdminBotsContent />
    </Suspense>
  );
}
