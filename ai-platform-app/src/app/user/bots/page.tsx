"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bot,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import {
  ADMIN_PAGE_META_TEXT_CLASS,
  adminFilterChipClass,
} from "@/components/admin/admin-page-classes";
import CreateNewBotButton from "@/components/admin/CreateNewBotButton";
import { SettingsModal } from "@/components/admin/settings/SettingsModal";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { parseAgentPrimaryColor, rgbaFromHex, textOnAccent } from "@/lib/agentAccent";
import { useUser } from "@/hooks/useUser";

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
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
  primaryColor?: string;
  avatarEmoji?: string;
  /** Bot profile / launcher image when set */
  imageUrl?: string;
};

type SortKey = "newest" | "oldest" | "name-asc" | "name-desc" | "published-first";

function agentNameInitials(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  const alnum = name.replace(/\s/g, "");
  if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
  return (name.slice(0, 2) || "A").toUpperCase();
}

function isLikelyHttpImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function AgentListingAvatar({
  bot,
  size,
}: {
  bot: BotRow;
  size: "grid" | "list";
}) {
  const accent = parseAgentPrimaryColor(bot.primaryColor);
  const labelOnAccent = textOnAccent(accent);
  const dim = size === "list" ? "h-10 w-10" : "h-11 w-11";
  const emojiText = size === "list" ? "text-lg" : "text-xl";
  const [imgFailed, setImgFailed] = useState(false);
  const rawUrl = bot.imageUrl?.trim() ?? "";
  const showImage = Boolean(rawUrl && !imgFailed && isLikelyHttpImageUrl(rawUrl));

  if (showImage) {
    return (
      <img
        src={rawUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={`flex ${dim} shrink-0 rounded-md object-cover`}
        style={{
          boxShadow: `inset 0 0 0 1px ${rgbaFromHex(accent, 0.22)}`,
        }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  if (bot.avatarEmoji) {
    return (
      <span
        className={`flex ${dim} shrink-0 items-center justify-center rounded-md ${emojiText} leading-none`}
        style={{
          backgroundColor: rgbaFromHex(accent, 0.14),
          boxShadow: `inset 0 0 0 1px ${rgbaFromHex(accent, 0.22)}`,
        }}
        aria-hidden
      >
        {bot.avatarEmoji}
      </span>
    );
  }

  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-md text-xs font-bold tracking-tight`}
      style={{
        backgroundColor: accent,
        color: labelOnAccent,
        boxShadow: `inset 0 1px 0 ${rgbaFromHex(accent, 0.3)}`,
      }}
      aria-hidden
    >
      {agentNameInitials(bot.name)}
    </span>
  );
}

function sortAgents(list: BotRow[], sortKey: SortKey): BotRow[] {
  const arr = [...list];
  const t = (b: BotRow) => new Date(b.createdAt || 0).getTime();
  switch (sortKey) {
    case "newest":
      return arr.sort((a, b) => t(b) - t(a));
    case "oldest":
      return arr.sort((a, b) => t(a) - t(b));
    case "name-asc":
      return arr.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    case "name-desc":
      return arr.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }));
    case "published-first":
      return arr.sort((a, b) => {
        if (a.status === "published" && b.status !== "published") return -1;
        if (b.status === "published" && a.status !== "published") return 1;
        return t(b) - t(a);
      });
    default:
      return arr;
  }
}

function UserBotsContent() {
  const { user, loading: authLoading } = useUser();
  const searchParams = useSearchParams();
  const statusFilter =
    searchParams?.get("status") === "draft" || searchParams?.get("status") === "published"
      ? searchParams.get("status")
      : "all";
  const [bots, setBots] = useState<BotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [botToDelete, setBotToDelete] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const SHOWCASE_PACK_CAP = 30;
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [packCount, setPackCount] = useState(3);
  const [packBusy, setPackBusy] = useState(false);
  const [packResultOpen, setPackResultOpen] = useState(false);
  const [packResultText, setPackResultText] = useState("");

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

  const sortedBots = useMemo(() => sortAgents(filteredBots, sortKey), [filteredBots, sortKey]);

  const stats = useMemo(() => {
    const published = bots.filter((b) => b.status === "published").length;
    const draft = bots.filter((b) => b.status === "draft").length;
    return { total: bots.length, published, draft };
  }, [bots]);

  const showcaseCount = useMemo(() => bots.filter((b) => b.type === "showcase").length, [bots]);
  const showcasePackRemaining = Math.max(0, SHOWCASE_PACK_CAP - showcaseCount);

  async function fetchBots() {
    const url = `/api/user/bots${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`;
    const res = await apiFetch(url);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setApiError(data.error ?? "Failed to load agents.");
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
          setApiError((data as { error?: string })?.error ?? "Failed to load agents.");
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

  const showcaseIdsOnPage = useMemo(
    () => sortedBots.filter((b) => b.type === "showcase").map((b) => String(b._id)),
    [sortedBots],
  );

  useEffect(() => {
    const valid = new Set(bots.map((b) => String(b._id)));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [bots]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllShowcaseOnPage() {
    setSelectedIds(new Set(showcaseIdsOnPage));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const selectedOnPageCount = useMemo(
    () => showcaseIdsOnPage.filter((id) => selectedIds.has(id)).length,
    [showcaseIdsOnPage, selectedIds],
  );

  const selectedShowcaseIds = useMemo(() => {
    return [...selectedIds].filter((id) => {
      const bot = bots.find((b) => String(b._id) === id);
      return bot && bot.type === "showcase";
    });
  }, [selectedIds, bots]);

  async function runShowcaseAgentsPack() {
    const n = Math.min(Math.max(1, Math.floor(packCount)), showcasePackRemaining);
    if (n < 1 || showcasePackRemaining === 0) return;
    if (
      !window.confirm(
        `Create ${n} AI-generated showcase agent(s)? Each gets unique branding, short replies with sources, multi-chat (5), Assistrio embed allowlist, and ingested docs. This can take a minute.`,
      )
    ) {
      return;
    }
    setPackBusy(true);
    setApiError(null);
    try {
      const res = await apiFetch("/api/user/seed/showcase-agents-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: n }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: Array<{ botId: string; slug: string; name: string; docsQueued: number; aiGenerated: boolean }>;
        errors?: Array<{ index: number; error: string }>;
        skippedDueToCap?: number;
        note?: string;
      };
      if (!res.ok) {
        setApiError(data.error ?? "Showcase pack failed.");
        setPackModalOpen(false);
        return;
      }
      const lines: string[] = [];
      if (Array.isArray(data.created)) {
        lines.push(`Created ${data.created.length} agent(s).`);
        data.created.forEach((c) => {
          lines.push(
            `• ${c.name} (${c.slug}) — docs queued: ${c.docsQueued}, AI: ${c.aiGenerated ? "yes" : "no"}`,
          );
        });
      }
      if (data.skippedDueToCap && data.skippedDueToCap > 0) {
        lines.push(`Skipped (30-agent cap): ${data.skippedDueToCap}.`);
      }
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        lines.push("Errors:");
        data.errors.forEach((e) => lines.push(`• #${e.index}: ${e.error}`));
      }
      if (data.note) lines.push("", data.note);
      setPackResultText(lines.join("\n"));
      setPackModalOpen(false);
      setPackResultOpen(true);
      await fetchBots();
    } catch {
      setApiError("Showcase pack failed. Please try again.");
      setPackModalOpen(false);
    } finally {
      setPackBusy(false);
    }
  }

  async function bulkDeleteSelected() {
    const ids = selectedShowcaseIds;
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete ${ids.length} agent(s) and all associated data (conversations, knowledge, documents, analytics)? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    setApiError(null);
    try {
      const res = await apiFetch("/api/user/bots/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: string[];
        failed?: Array<{ id: string; error: string }>;
      };
      if (!res.ok) {
        setApiError(data.error ?? "Bulk delete failed.");
        return;
      }
      const deleted = data.deleted ?? [];
      const failed = data.failed ?? [];
      clearSelection();
      await fetchBots();
      if (failed.length > 0) {
        setApiError(
          `Removed ${deleted.length}. Could not delete ${failed.length}: ${failed.map((f) => `${f.id.slice(-6)} (${f.error})`).join(", ")}`,
        );
      }
    } catch {
      setApiError("Bulk delete failed. Please try again.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function confirmDelete() {
    if (!botToDelete) return;
    setDeletingId(botToDelete.id);
    setApiError(null);
    try {
      const res = await apiFetch(`/api/user/bots/${botToDelete.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setApiError(data.error ?? "Failed to delete agent.");
        return;
      }
      setBotToDelete(null);
      await fetchBots();
    } catch {
      setApiError("Failed to delete agent. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const toolbar = (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <label htmlFor="agent-search" className="sr-only">
            Search agents
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={2}
            aria-hidden
          />
          <input
            id="agent-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, category, or type…"
            className="min-w-0 w-full rounded-md border border-slate-200/90 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <label htmlFor="agent-sort" className="sr-only">
              Sort agents
            </label>
            <select
              id="agent-sort"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-md border border-slate-200/90 bg-white py-1.5 pl-2 pr-8 text-xs font-medium text-slate-800 shadow-sm focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="published-first">Published first</option>
            </select>
          </div>
          <div
            className="ml-auto flex rounded-md border border-slate-200/90 p-0.5 dark:border-slate-700 lg:ml-0"
            role="group"
            aria-label="View layout"
          >
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              className={
                view === "grid"
                  ? "rounded-sm bg-brand-50 px-2 py-1 text-brand-800 dark:bg-brand-950/50 dark:text-brand-200"
                  : "rounded-sm px-2 py-1 text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={
                view === "list"
                  ? "rounded-sm bg-brand-50 px-2 py-1 text-brand-800 dark:bg-brand-950/50 dark:text-brand-200"
                  : "rounded-sm px-2 py-1 text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }
              title="List view"
            >
              <List className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {showcaseIdsOnPage.length > 0 ? (
        <div
          className="flex flex-col gap-2 rounded-md border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          role="region"
          aria-label="Bulk selection"
        >
          <p className="text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">{selectedShowcaseIds.length}</span>{" "}
            selected
            {search.trim() ? (
              <>
                {" "}
                · <span className="tabular-nums">{selectedOnPageCount}</span> on this page
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => selectAllShowcaseOnPage()}
              disabled={
                bulkDeleting || (showcaseIdsOnPage.length > 0 && showcaseIdsOnPage.every((id) => selectedIds.has(id)))
              }
            >
              Select all on page
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => clearSelection()}
              disabled={bulkDeleting || selectedIds.size === 0}
            >
              Clear selection
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="border border-red-200/90 text-xs text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
              onClick={() => void bulkDeleteSelected()}
              disabled={bulkDeleting || selectedShowcaseIds.length === 0}
            >
              {bulkDeleting ? "Deleting…" : "Delete selected"}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <p className={ADMIN_PAGE_META_TEXT_CLASS}>
          Showing{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">{sortedBots.length}</span>
          {search.trim() ? (
            <>
              {" "}
              matching · <span className="font-medium text-slate-700 dark:text-slate-300">{bots.length}</span> total
            </>
          ) : (
            <>
              {" "}
              of <span className="font-medium text-slate-700 dark:text-slate-300">{bots.length}</span> agents
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Status
          </span>
          <Link href="/user/bots" className={adminFilterChipClass(statusFilter === "all")}>
            All
          </Link>
          <Link href="/user/bots?status=draft" className={adminFilterChipClass(statusFilter === "draft")}>
            Draft
          </Link>
          <Link href="/user/bots?status=published" className={adminFilterChipClass(statusFilter === "published")}>
            Published
          </Link>
        </div>
      </div>
    </div>
  );

  if (authLoading || !user) {
    return (
      <AdminShell showTitleRow={false} toolbar={toolbar}>
        <AgentsHero stats={{ total: 0, published: 0, draft: 0 }} loading />
        <AgentListSkeleton view="grid" />
      </AdminShell>
    );
  }

  return (
    <AdminShell showTitleRow={false} toolbar={toolbar}>
      <AgentsHero
        stats={stats}
        loading={false}
        primaryAction={
          <CreateNewBotButton className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-br from-brand-500 to-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-teal-900/10 ring-1 ring-teal-700/10 transition hover:from-brand-600 hover:to-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40" />
        }
      />

      {user.role === "superadmin" ? (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-violet-200/80 bg-violet-50/60 px-4 py-3 dark:border-violet-900/45 dark:bg-violet-950/25 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">AI showcase pack</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-400">
              Generate distinct showcase agents (branding, AI docs, quick links, multi-chat max 5, short replies + sources).
              You have <span className="font-medium text-slate-800 dark:text-slate-200">{showcaseCount}</span> /{" "}
              {SHOWCASE_PACK_CAP} showcase agents.
              {showcasePackRemaining === 0 ? " Cap reached." : ` Up to ${showcasePackRemaining} more can be added.`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 border border-violet-200/90 bg-white/90 text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-900/60 dark:text-violet-200 dark:hover:bg-violet-950/50"
            disabled={packBusy || showcasePackRemaining === 0}
            onClick={() => {
              setPackCount(Math.min(3, Math.max(1, showcasePackRemaining)));
              setPackModalOpen(true);
            }}
          >
            {packBusy ? "Working…" : "Generate pack…"}
          </Button>
        </div>
      ) : null}

      {apiError ? (
        <div
          className="mb-6 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
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
        open={packModalOpen}
        onClose={() => !packBusy && setPackModalOpen(false)}
        title="Generate showcase agents"
        description={`How many new showcase agents to create (1–${Math.max(1, showcasePackRemaining)})? Requires OPENAI_API_KEY on the server for full AI content.`}
        maxWidthClass="max-w-md"
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPackModalOpen(false)} disabled={packBusy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void runShowcaseAgentsPack()}
              disabled={packBusy || showcasePackRemaining === 0}
            >
              {packBusy ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <label htmlFor="pack-count" className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Count
          </label>
          <input
            id="pack-count"
            type="number"
            min={1}
            max={Math.max(1, showcasePackRemaining)}
            value={packCount}
            onChange={(e) => setPackCount(Number(e.target.value))}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </SettingsModal>

      <SettingsModal
        open={packResultOpen}
        onClose={() => setPackResultOpen(false)}
        title="Showcase pack result"
        maxWidthClass="max-w-lg"
        footer={
          <Button type="button" variant="primary" size="sm" onClick={() => setPackResultOpen(false)}>
            OK
          </Button>
        }
      >
        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-400">
          {packResultText}
        </pre>
      </SettingsModal>

      <SettingsModal
        open={botToDelete !== null}
        onClose={() => !deletingId && setBotToDelete(null)}
        title="Delete agent?"
        description={
          botToDelete ? `"${botToDelete.name}" will be permanently deleted. This cannot be undone.` : undefined
        }
        maxWidthClass="max-w-md"
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setBotToDelete(null)} disabled={!!deletingId}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => void confirmDelete()} disabled={!!deletingId}>
              {deletingId ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          All associated documents and training data for this agent will be removed.
        </p>
      </SettingsModal>

      {loading ? (
        <AgentListSkeleton view={view} />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedBots.map((bot) => (
            <AgentCard
              key={String(bot._id)}
              bot={bot}
              deletingId={deletingId}
              onDeleteRequest={(id, name) => setBotToDelete({ id, name })}
              selection={
                bot.type === "showcase"
                  ? {
                    checked: selectedIds.has(String(bot._id)),
                    onToggle: () => toggleSelect(String(bot._id)),
                    disabled: bulkDeleting,
                  }
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedBots.map((bot) => (
              <AgentListRow
                key={String(bot._id)}
                bot={bot}
                deletingId={deletingId}
                onDeleteRequest={(id, name) => setBotToDelete({ id, name })}
                selection={
                  bot.type === "showcase"
                    ? {
                      checked: selectedIds.has(String(bot._id)),
                      onToggle: () => toggleSelect(String(bot._id)),
                      disabled: bulkDeleting,
                    }
                    : undefined
                }
              />
            ))}
          </ul>
        </div>
      )}

      {!loading && sortedBots.length === 0 ? (
        <EmptyAgentsState totalBots={bots.length} />
      ) : null}
    </AdminShell>
  );
}

function AgentsHero({
  stats,
  loading,
  primaryAction,
  secondaryAction,
}: {
  stats: { total: number; published: number; draft: number };
  loading?: boolean;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <section
      className="relative mb-4 shrink-0 rounded-lg border border-teal-200/50 bg-gradient-to-br from-white via-teal-50/40 to-slate-50/80 p-3 shadow-sm ring-1 ring-teal-100/30 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900/80 dark:to-slate-950 dark:ring-slate-800/60 sm:p-3.5"
      aria-labelledby="agents-hero-heading"
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-teal-300/90 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-900 ring-1 ring-teal-700/10 dark:border-teal-500/35 dark:bg-slate-900/90 dark:text-teal-100 dark:ring-teal-400/15">
              <Sparkles className="h-3 w-3 shrink-0 text-teal-600 dark:text-teal-300" aria-hidden />
              AI workspace
            </span>
            <h1
              id="agents-hero-heading"
              className="text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-white sm:text-xl"
            >
              Agents
            </h1>
          </div>
          <p className="max-w-2xl text-[11px] leading-snug text-slate-600 dark:text-slate-400">
            Design, train, and deploy agents—knowledge, behavior, and chat from one place.
          </p>
          <dl className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-baseline gap-1.5 rounded border border-slate-200/80 bg-white/70 px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900/50">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Total</dt>
              <dd className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {loading ? "—" : stats.total}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5 rounded border border-slate-200/80 bg-white/70 px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900/50">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Published
              </dt>
              <dd className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {loading ? "—" : stats.published}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5 rounded border border-slate-200/80 bg-white/70 px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900/50">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Draft</dt>
              <dd className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {loading ? "—" : stats.draft}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {primaryAction}
          {secondaryAction ? <div className="w-full sm:w-auto">{secondaryAction}</div> : null}
        </div>
      </div>
    </section>
  );
}

function AgentCard({
  bot,
  deletingId,
  onDeleteRequest,
  selection,
}: {
  bot: BotRow;
  deletingId: string | null;
  onDeleteRequest: (id: string, name: string) => void;
  selection?: {
    checked: boolean;
    onToggle: () => void;
    disabled?: boolean;
  };
}) {
  const isEditable = bot.type === "showcase";
  const href = `/user/bots/${String(bot._id)}/playground/profile`;
  const accent = parseAgentPrimaryColor(bot.primaryColor);
  const accentSoft = rgbaFromHex(accent, 0.12);
  const accentBorder = rgbaFromHex(accent, 0.32);
  const labelOnAccent = textOnAccent(accent);

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm transition hover:border-teal-200/80 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
      style={{
        borderTopWidth: 2,
        borderTopColor: accent,
        backgroundImage: `linear-gradient(180deg, ${accentSoft} 0%, transparent 42%)`,
      }}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        {selection ? (
          <label className="flex shrink-0 cursor-pointer items-center pt-1">
            <input
              type="checkbox"
              checked={selection.checked}
              onChange={() => selection.onToggle()}
              disabled={selection.disabled}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
            />
            <span className="sr-only">Select {bot.name}</span>
          </label>
        ) : null}
        <AgentListingAvatar bot={bot} size="grid" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold tracking-tight text-slate-900 dark:text-white">{bot.name}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{bot.category?.trim() ? bot.category : "Uncategorized"}</span>
            <span className="text-slate-300 dark:text-slate-600"> · </span>
            <span className="font-mono text-[10px] uppercase text-slate-400 dark:text-slate-500">{bot.type}</span>
          </p>
        </div>
        {bot.status === "published" ? (
          <span
            className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              border: `1px solid ${accentBorder}`,
              backgroundColor: rgbaFromHex(accent, 0.1),
              color: accent,
            }}
          >
            Live
          </span>
        ) : (
          <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Draft
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-2 px-4 pb-3 text-xs">
        <div className="rounded-md border border-slate-100 bg-slate-50/90 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-950/40">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Visibility</dt>
          <dd className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">{bot.isPublic ? "Public" : "Private"}</dd>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/90 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-950/40">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Created</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-slate-800 dark:text-slate-200">{formatDate(bot.createdAt)}</dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100/90 bg-slate-50/50 px-4 py-3 dark:border-slate-800/90 dark:bg-slate-950/30">
        {isEditable ? (
          <>
            <Link
              href={href}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition hover:brightness-105 active:scale-[0.99] sm:flex-initial"
              style={{
                backgroundColor: accent,
                color: labelOnAccent,
                boxShadow: `0 2px 10px ${rgbaFromHex(accent, 0.28)}`,
              }}
            >
              Open workspace
              <ArrowUpRight className="h-4 w-4 opacity-90" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => onDeleteRequest(String(bot._id), bot.name)}
              disabled={deletingId === bot._id}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-white text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/35"
              title="Delete agent"
              aria-label="Delete agent"
            >
              {deletingId === bot._id ? (
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-500">This agent type cannot be opened in the workspace.</p>
        )}
      </div>
    </article>
  );
}

function AgentListRow({
  bot,
  deletingId,
  onDeleteRequest,
  selection,
}: {
  bot: BotRow;
  deletingId: string | null;
  onDeleteRequest: (id: string, name: string) => void;
  selection?: {
    checked: boolean;
    onToggle: () => void;
    disabled?: boolean;
  };
}) {
  const isEditable = bot.type === "showcase";
  const href = `/user/bots/${String(bot._id)}/playground/profile`;
  const accent = parseAgentPrimaryColor(bot.primaryColor);
  const labelOnAccent = textOnAccent(accent);

  return (
    <li className="flex flex-col gap-3 p-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:gap-4 dark:hover:bg-slate-900/40">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {selection ? (
          <label className="flex shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={selection.checked}
              onChange={() => selection.onToggle()}
              disabled={selection.disabled}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
            />
            <span className="sr-only">Select {bot.name}</span>
          </label>
        ) : null}
        <AgentListingAvatar bot={bot} size="list" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 dark:text-white">{bot.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {bot.category?.trim() || "Uncategorized"} · <span className="font-mono">{bot.type}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {bot.status === "published" ? (
          <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Live
          </span>
        ) : (
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Draft
          </span>
        )}
        <span className="hidden text-xs tabular-nums text-slate-500 md:inline dark:text-slate-400">
          {formatDateTime(bot.createdAt)}
        </span>
        {isEditable ? (
          <div className="flex items-center gap-1.5">
            <Link
              href={href}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-95"
              style={{ backgroundColor: accent, color: labelOnAccent }}
            >
              Open
              <ArrowUpRight className="h-3.5 w-3.5 opacity-90" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => onDeleteRequest(String(bot._id), bot.name)}
              disabled={deletingId === bot._id}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-red-950/35"
              aria-label="Delete agent"
            >
              {deletingId === bot._id ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Not editable</span>
        )}
      </div>
    </li>
  );
}

function AgentListSkeleton({ view }: { view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <div className="overflow-hidden rounded-md border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/40">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={`ls-${i}`} className="flex animate-pulse gap-4 p-4">
              <div className="h-10 w-10 shrink-0 rounded-md bg-slate-200 dark:bg-slate-800" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={`sk-${i}`}
          className="animate-pulse overflow-hidden rounded-lg border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/50"
        >
          <div className="h-1 bg-slate-200 dark:bg-slate-700" />
          <div className="p-4">
            <div className="flex gap-3">
              <div className="h-11 w-11 shrink-0 rounded-md bg-slate-100 dark:bg-slate-800" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="h-14 rounded-md bg-slate-50 dark:bg-slate-800/80" />
              <div className="h-14 rounded-md bg-slate-50 dark:bg-slate-800/80" />
            </div>
            <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="h-9 flex-1 rounded-md bg-slate-100 dark:bg-slate-800" />
              <div className="h-9 w-9 shrink-0 rounded-md bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyAgentsState({ totalBots }: { totalBots: number }) {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-teal-200/70 bg-gradient-to-b from-teal-50/30 to-slate-50/40 px-6 py-14 text-center dark:border-slate-700 dark:from-slate-900/40 dark:to-slate-950/40">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400">
        <Bot className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-100">
        {totalBots === 0 ? "No agents yet" : "No agents match your filters"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
        {totalBots === 0
          ? "Create your first agent to connect knowledge sources, define behavior, and publish your chat experience."
          : "Try adjusting search, sort, or status filters."}
      </p>
      {totalBots === 0 ? (
        <div className="mt-6 flex justify-center">
          <CreateNewBotButton className="inline-flex items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md ring-1 ring-teal-700/10 transition hover:from-brand-600 hover:to-brand-700" />
        </div>
      ) : null}
    </div>
  );
}

export default function UserBotsPage() {
  return (
    <Suspense
      fallback={
        <AdminShell showTitleRow={false}>
          <AgentsHero stats={{ total: 0, published: 0, draft: 0 }} loading />
          <AgentListSkeleton view="grid" />
        </AdminShell>
      }
    >
      <UserBotsContent />
    </Suspense>
  );
}
