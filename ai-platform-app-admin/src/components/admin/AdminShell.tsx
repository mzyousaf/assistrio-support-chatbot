"use client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Layers, LogOut, Menu, Settings, Sparkles } from "lucide-react";

import { AgentSidebar } from "@/components/admin/AgentSidebar";
import { WorkspaceAssistantBlock } from "@/components/admin/WorkspaceAssistantBlock";
import { useLaunchReadinessSidebarState } from "@/contexts/LaunchReadinessSidebarContext";
import { apiFetch } from "@/lib/api";
import { useUser } from "@/hooks/useUser";
import {
  getBotIdFromPath,
  getBotsBasePath,
  getCanonicalUserPath,
  getShellPageTitle,
  getWorkspaceHomeHref,
  getWorkspaceSettingsHref,
  MAIN_SIDEBAR,
  resolveUserHref,
  showAgentWorkspaceChrome,
  WORKSPACE_DISPLAY_NAME,
} from "@/components/admin/admin-shell-config";
import {
  SIDEBAR_EXPANDED_WIDTH_CLAMP,
  WORKSPACE_SIDEBAR_EXPANDED_PX,
} from "@/components/admin/agent-sidebar-layout";
import {
  SHELL_NAV_NESTED_ACTIVE,
  SHELL_NAV_NESTED_INACTIVE,
  SHELL_NAV_TOP_ACTIVE,
  SHELL_NAV_TOP_INACTIVE,
} from "@/components/admin/shell-nav-classes";

interface AdminShellProps {
  title?: string;
  /** Short description under the page title (left column). */
  subtitle?: ReactNode;
  /** Primary actions aligned to the right of the title row (e.g. create buttons). */
  actions?: ReactNode;
  /** Filters, search, and list controls — rendered in a consistent toolbar below the title row. */
  toolbar?: ReactNode;
  children: ReactNode;
  /** When true, main content stacks full-width within the shell (still capped at max-w-screen-2xl). */
  fullWidth?: boolean;
  /** Agent display name when inside /user/bots/[id]/* (agent sidebar header). */
  agentTitle?: string;
  /** When false, hides the title/subtitle/actions row so the page can render a custom hero; toolbar still shows if set. */
  showTitleRow?: boolean;
}

function cx(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}

/** First two letters from the email local part for avatar (fallbacks if needed). */
function getEmailAvatarInitials(email: string | undefined): string {
  if (!email?.trim()) return "?";
  const local = email.split("@")[0] ?? "";
  const letters = local.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  if (letters.length === 1) return `${letters[0].toUpperCase()}${letters[0].toUpperCase()}`;
  const alnum = email.replace(/[^a-zA-Z0-9]/g, "");
  if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default function AdminShell({
  title,
  subtitle,
  actions,
  toolbar,
  children,
  fullWidth,
  agentTitle,
  showTitleRow = true,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const canonicalPath = getCanonicalUserPath(pathname);
  const { user, loading: userLoading } = useUser();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileAgentOpen, setMobileAgentOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const workspaceAsideRef = useRef<HTMLElement>(null);
  const mobileAgentPanelRef = useRef<HTMLDivElement>(null);

  /** Only on `/user/bots/[id]/…` — drives compact rail + second sidebar (nowhere else). */
  const agentChrome = showAgentWorkspaceChrome(canonicalPath);
  const botWorkspaceId = getBotIdFromPath(canonicalPath);
  const compactMainNav = agentChrome && !mobileNavOpen;

  const workspaceHomeHref = getWorkspaceHomeHref(pathname);
  const settingsHref = getWorkspaceSettingsHref(pathname);
  const agentEntryHref =
    agentChrome && botWorkspaceId
      ? `${getBotsBasePath(pathname)}/${botWorkspaceId}/playground/profile`
      : null;
  const agentHeaderLabel =
    agentChrome && botWorkspaceId ? (agentTitle?.trim() ? agentTitle.trim() : "Agent") : null;

  const launchReadinessSidebar = useLaunchReadinessSidebarState();
  const hasWorkspaceAssistantSnapshot = Boolean(
    agentChrome &&
      botWorkspaceId &&
      launchReadinessSidebar?.snapshot &&
      launchReadinessSidebar.snapshot.botId === botWorkspaceId,
  );

  const displayPageTitle = getShellPageTitle(canonicalPath, title);
  const hasTitleRow = showTitleRow && Boolean(displayPageTitle || subtitle || actions);
  const hasPageHeader = Boolean(hasTitleRow || toolbar);

  useEffect(() => {
    setMobileNavOpen(false);
    setMobileAgentOpen(false);
  }, [pathname]);

  useEffect(() => {
    const saved = localStorage.getItem("admin_theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      return;
    }
    setTheme("light");
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!userMenuOpen) return;
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [userMenuOpen]);

  /** Move focus into the opened mobile drawer for keyboard users. */
  useEffect(() => {
    if (!mobileNavOpen) return;
    const id = window.setTimeout(() => {
      const first = workspaceAsideRef.current?.querySelector<HTMLElement>("nav a[href]");
      first?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileAgentOpen) return;
    const id = window.setTimeout(() => {
      const first = mobileAgentPanelRef.current?.querySelector<HTMLElement>("nav a[href], nav button");
      first?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [mobileAgentOpen]);

  useEffect(() => {
    if (!mobileNavOpen && !mobileAgentOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
        setMobileAgentOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen, mobileAgentOpen]);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("admin_theme", next);
      return next;
    });
  }

  async function handleLogout() {
    setUserMenuOpen(false);
    await apiFetch("/api/user/logout", { method: "POST" });
    router.push("/user/login");
  }

  const shellSurface =
    theme === "dark"
      ? "bg-slate-950 text-slate-100"
      : "bg-[#f4fbfb] text-slate-900";

  const cardSurface = theme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-white border-teal-200/60";

  return (
    <div
      className={cx(
        theme === "dark" && "dark",
        "admin-theme flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden font-body",
        shellSurface,
      )}
      style={
        { ["--sidebar-expanded" as string]: SIDEBAR_EXPANDED_WIDTH_CLAMP } as React.CSSProperties
      }
    >
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {mobileAgentOpen && agentChrome && botWorkspaceId ? (
        <button
          type="button"
          className="fixed inset-0 z-[45] bg-slate-900/40 backdrop-blur-[2px] lg:hidden"
          aria-label="Close agent menu"
          onClick={() => setMobileAgentOpen(false)}
        />
      ) : null}

      {/* Full-width top bar — above sidebar + main */}
      <header
        className={cx(
          "sticky top-0 z-[60] w-full shrink-0 border-b backdrop-blur-sm",
          theme === "dark"
            ? "border-slate-800/90 bg-slate-950/95"
            : "border-teal-200/45 bg-white/90",
        )}
      >
        <div className="flex h-12 w-full items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200/90 bg-white text-slate-700 transition hover:border-teal-300/80 hover:bg-teal-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Open workspace navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
            {agentChrome && botWorkspaceId ? (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200/90 bg-white text-slate-700 transition hover:border-teal-300/80 hover:bg-teal-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                aria-label="Open agent navigation"
                onClick={() => setMobileAgentOpen(true)}
              >
                <Layers className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            ) : null}
          </div>

          <div
            role="navigation"
            aria-label="Workspace"
            className="flex min-w-0 flex-1 items-center gap-2 text-sm sm:gap-2.5"
          >
            <Link
              href={workspaceHomeHref}
              className="flex shrink-0 items-center rounded-sm outline-none ring-brand-500/30 transition hover:opacity-90 focus-visible:ring-2 dark:hover:opacity-95"
              title={`${WORKSPACE_DISPLAY_NAME} — Home`}
              onClick={() => setMobileNavOpen(false)}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-sm ring-1 ring-teal-700/10">
                <Sparkles className="h-[15px] w-[15px]" aria-hidden />
              </span>
            </Link>
            <span className="shrink-0 text-slate-300 select-none dark:text-slate-600" aria-hidden>
              /
            </span>
            <Link
              href={workspaceHomeHref}
              className="min-w-0 shrink truncate font-semibold tracking-tight text-slate-900 transition hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
              onClick={() => setMobileNavOpen(false)}
            >
              {WORKSPACE_DISPLAY_NAME}
            </Link>
            {agentHeaderLabel && agentEntryHref ? (
              <>
                <span className="shrink-0 text-slate-300 select-none dark:text-slate-600" aria-hidden>
                  /
                </span>
                <Link
                  href={agentEntryHref}
                  className="min-w-0 max-w-[min(100%,12rem)] truncate font-medium text-slate-600 transition hover:text-brand-700 dark:text-slate-300 dark:hover:text-brand-300 sm:max-w-[20rem]"
                  title={`Agent: ${agentHeaderLabel}`}
                  onClick={() => {
                    setMobileNavOpen(false);
                    setMobileAgentOpen(false);
                  }}
                >
                  {agentHeaderLabel}
                </Link>
              </>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className={cx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold tracking-tight outline-none ring-brand-500/30 transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-offset-2",
                  theme === "dark"
                    ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white focus-visible:ring-offset-slate-950"
                    : "bg-gradient-to-br from-brand-500 to-brand-600 text-white focus-visible:ring-offset-white",
                )}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={userLoading ? "Account menu" : `Account menu, ${user?.email ?? ""}`}
                title={user?.email ?? "Account"}
              >
                {userLoading ? (
                  <span className="text-xs font-normal opacity-80" aria-hidden>
                    …
                  </span>
                ) : (
                  <span aria-hidden>{getEmailAvatarInitials(user?.email)}</span>
                )}
              </button>
              {userMenuOpen ? (
                <div
                  role="menu"
                  className={cx(
                    "absolute right-0 z-[70] mt-1.5 w-56 overflow-hidden rounded-md border py-1 shadow-md",
                    theme === "dark"
                      ? "border-slate-700 bg-slate-900 text-slate-100"
                      : "border-slate-200 bg-white text-slate-800",
                  )}
                >
                  {user?.email ? (
                    <div
                      className={cx(
                        "border-b px-3 py-2.5 text-xs",
                        theme === "dark" ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500",
                      )}
                    >
                      <p className="truncate font-medium text-slate-800 dark:text-slate-200" title={user.email}>
                        {user.email}
                      </p>
                    </div>
                  ) : null}
                  <Link
                    href={settingsHref}
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    Workspace settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => {
                      setUserMenuOpen(false);
                      toggleTheme();
                    }}
                  >
                    {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  </button>
                  <div
                    className={cx(
                      "my-1 border-t",
                      theme === "dark" ? "border-slate-800" : "border-slate-100",
                    )}
                  />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-800 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => void handleLogout()}
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Below header: workspace sidebar(s) + main — fills remaining viewport height.
          In agent workspace, use CSS Grid at lg+; agent column uses same --sidebar-expanded as expanded workspace aside. */}
      <div
        className={cx(
          "flex min-h-0 min-w-0 flex-1 items-stretch",
          agentChrome &&
            botWorkspaceId &&
            "lg:!grid lg:gap-0 lg:[grid-template-columns:auto_var(--sidebar-expanded)_minmax(0,1fr)]",
        )}
      >
        {/* Sidebar 1 — global workspace (icon rail when in agent workspace) */}
        <aside
          ref={workspaceAsideRef}
          className={cx(
            "fixed bottom-0 left-0 top-12 z-50 flex min-h-0 w-[min(100vw,280px)] flex-col border-r transition-transform duration-200 ease-out lg:static lg:top-auto lg:z-0 lg:h-full lg:min-h-0 lg:max-h-none lg:translate-x-0 lg:self-stretch",
            cardSurface,
            theme === "dark"
              ? "border-slate-800 shadow-none"
              : "border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
            agentChrome && compactMainNav
              ? "lg:border-r lg:border-teal-200/35 lg:bg-gradient-to-b lg:from-teal-50/50 lg:to-white dark:lg:border-slate-800/90 dark:lg:from-slate-950 dark:lg:to-slate-950"
              : null,
            compactMainNav
              ? "lg:w-[72px] lg:min-w-[72px]"
              : "lg:w-[var(--sidebar-expanded)] lg:min-w-[200px] lg:max-w-[260px]",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-3 pt-4" aria-label="Workspace navigation">
          {MAIN_SIDEBAR.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(canonicalPath);
            return (
              <div key={item.id} className="space-y-0.5">
                <Link
                  href={resolveUserHref(pathname, item.href)}
                  title={item.label}
                  className={cx(
                    "flex items-center gap-3 rounded-md py-2 pl-2 pr-2 text-sm font-medium transition-colors",
                    compactMainNav ? "lg:justify-center lg:px-1.5" : "",
                    active ? SHELL_NAV_TOP_ACTIVE : SHELL_NAV_TOP_INACTIVE,
                  )}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Icon
                    className={cx(
                      "h-[18px] w-[18px] shrink-0",
                      active ? "text-brand-600 dark:text-brand-400" : "opacity-85",
                    )}
                    aria-hidden
                  />
                  <span className={cx("truncate", compactMainNav && "lg:sr-only")}>{item.label}</span>
                </Link>
                {!compactMainNav && item.children && item.children.length > 0 ? (
                  <div className="ml-2 border-l border-slate-200/90 py-0.5 pl-3 dark:border-slate-700">
                    {item.children.map((child) => {
                      const p = canonicalPath.split("?")[0];
                      const childActive = p === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={resolveUserHref(pathname, child.href)}
                          className={cx(
                            "block rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                            childActive ? SHELL_NAV_NESTED_ACTIVE : SHELL_NAV_NESTED_INACTIVE,
                          )}
                          onClick={() => setMobileNavOpen(false)}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div
          className={cx(
            "shrink-0 border-t border-slate-200/80 p-4 dark:border-slate-800",
            compactMainNav && "lg:hidden",
          )}
        >
          {hasWorkspaceAssistantSnapshot && botWorkspaceId ? (
            <WorkspaceAssistantBlock theme={theme} botId={botWorkspaceId} />
          ) : null}
          {!hasWorkspaceAssistantSnapshot ? (
            <div
              className={cx(
                "rounded-md border p-3",
                theme === "dark" ? "border-brand-500/20 bg-brand-500/5" : "border-brand-500/10 bg-brand-50/60",
              )}
            >
              <p className="text-xs font-medium text-slate-800 dark:text-slate-100">Need a hand?</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Docs and best practices for agents and embeddings.
              </p>
              <Link
                href="/user/dashboard"
                className="mt-3 inline-flex text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                onClick={() => setMobileNavOpen(false)}
              >
                View overview →
              </Link>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Sidebar 2 — agent workspace only (not on /user/bots or /user/bots/new) */}
      {agentChrome && botWorkspaceId ? (
        <>
          <div className="hidden min-h-0 overflow-hidden lg:flex lg:h-full lg:min-h-0 lg:w-full lg:flex-col">
            <AgentSidebar botId={botWorkspaceId} theme={theme} agentLabel={agentTitle} />
          </div>
          {mobileAgentOpen ? (
            <div
              ref={mobileAgentPanelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Agent navigation"
              className="fixed bottom-0 right-0 top-12 z-50 flex h-[calc(100dvh-3rem)] min-h-0 flex-col overflow-hidden border-l border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.1)] dark:border-slate-800 lg:hidden"
              style={{ width: `min(100vw, ${WORKSPACE_SIDEBAR_EXPANDED_PX}px)` }}
            >
              <AgentSidebar botId={botWorkspaceId} theme={theme} agentLabel={agentTitle} />
            </div>
          ) : null}
        </>
      ) : null}

      {/* Main column — scrollable page content only (header is global above) */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile: agent sections only (no global secondary nav) */}
        {agentChrome && botWorkspaceId ? (
          <div
            className={cx(
              "flex items-center justify-between gap-2 border-b px-3 py-2 lg:hidden",
              theme === "dark" ? "border-slate-800 bg-slate-900/40" : "border-slate-200/80 bg-white/70",
            )}
          >
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">In this agent</p>
            <button
              type="button"
              onClick={() => setMobileAgentOpen(true)}
              className="rounded-sm border border-brand-200/90 bg-brand-50/80 px-3 py-1.5 text-xs font-semibold text-brand-800 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-200"
            >
              Sections
            </button>
          </div>
        ) : null}

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-5 lg:px-7">
          <div
            className={cx(
              "mx-auto flex min-h-0 w-full flex-1 flex-col",
              fullWidth ? "max-w-[min(1800px,100%)]" : "max-w-screen-2xl",
              !fullWidth && "space-y-6",
            )}
          >
            {hasPageHeader ? (
              <div className="space-y-4">
                {hasTitleRow ? (
                  <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {displayPageTitle ? (
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                          {displayPageTitle}
                        </h1>
                      ) : null}
                      {subtitle ? (
                        <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</div>
                      ) : null}
                    </div>
                    {actions ? (
                      <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                        {actions}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {toolbar ? (
                  <div className="flex flex-col gap-3 rounded-md border border-slate-200/90 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:p-4">
                    {toolbar}
                  </div>
                ) : null}
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
    </div>
  );
}
