import type { LucideIcon } from "lucide-react";
import { BarChart3, Bot, Building2 } from "lucide-react";

export type MainNavId = "agents" | "analytics" | "workspace";

export interface MainNavItem {
  id: MainNavId;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Highlight when pathname matches (canonical `/user/...` path). */
  isActive: (canonicalPath: string) => boolean;
  /** Nested links (e.g. workspace settings) — shown when main sidebar is expanded. */
  children?: { label: string; href: string }[];
}

/** Primary workspace navigation (sidebar 1). All `href` values use the `/user/...` prefix; use `resolveUserHref` for `/admin` mirrors. */
export const MAIN_SIDEBAR: MainNavItem[] = [
  {
    id: "agents",
    label: "Agents",
    href: "/user/bots",
    icon: Bot,
    isActive: (p) => p.startsWith("/user/bots") || p.startsWith("/user/visitors"),
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/user/analytics",
    icon: BarChart3,
    isActive: (p) => p.startsWith("/user/analytics"),
    children: [
      { label: "Overview", href: "/user/analytics" },
      { label: "Chats", href: "/user/analytics/chats" },
      { label: "Topics", href: "/user/analytics/topics" },
      { label: "Sentiment", href: "/user/analytics/sentiment" },
    ],
  },
  {
    id: "workspace",
    label: "Workspace Settings",
    href: "/user/settings/general",
    icon: Building2,
    isActive: (p) => p.startsWith("/user/settings"),
    children: [
      { label: "General", href: "/user/settings/general" },
      { label: "Members", href: "/user/settings/members" },
      { label: "Plans", href: "/user/settings/plans" },
      { label: "Billing", href: "/user/settings/billing" },
      { label: "API Keys", href: "/user/settings/api-keys" },
      { label: "Usage limits", href: "/user/settings/limits" },
    ],
  },
];

/** Map `/user/...` routes to `/admin/...` when the app is under `/admin`. */
export function resolveUserHref(pathname: string, userHref: string): string {
  if (!userHref.startsWith("/user")) return userHref;
  if (pathname.startsWith("/admin")) {
    return `/admin${userHref.slice("/user".length)}`;
  }
  return userHref;
}

/** Visible page title from route when `AdminShell` `title` is omitted. Uses canonical `/user/...` paths. */
export function getShellPageTitle(canonicalPath: string, explicitTitle?: string): string | undefined {
  const p = canonicalPath.split("?")[0];
  if (explicitTitle?.trim()) return explicitTitle.trim();

  for (const item of MAIN_SIDEBAR) {
    if (item.children) {
      for (const child of item.children) {
        if (p === child.href) return child.label;
      }
    }
  }

  if (p === "/user/dashboard") return "Dashboard";
  if (p === "/user/bots/new") return "Create agent";
  if (p === "/user/bots") return "Agents";
  if (p === "/user/visitors" || p.startsWith("/user/visitors/")) return "Visitors";

  for (const item of MAIN_SIDEBAR) {
    if (p === item.href) return item.label;
  }

  return undefined;
}

/**
 * Normalize legacy `/admin/*` routes to canonical `/user/*` for nav matching.
 */
export function getCanonicalUserPath(pathname: string): string {
  if (pathname.startsWith("/admin")) {
    return `/user${pathname.slice("/admin".length)}`;
  }
  if (pathname.startsWith("/super-admin")) {
    return `/user${pathname.slice("/super-admin".length)}`;
  }
  if (pathname.startsWith("/user")) {
    return pathname;
  }
  return pathname;
}

/**
 * Extract `/user/bots/[id]` id (including nested routes) when segment is not `new`.
 */
export function getBotIdFromPath(canonicalPath: string): string | null {
  const p = canonicalPath.split("?")[0];
  const m = /^\/user\/bots\/([^/]+)/.exec(p);
  if (!m) return null;
  const id = m[1];
  if (id === "new") return null;
  return id;
}

/**
 * Agent detail/workspace: `/user/bots/[id]` and nested `/user/bots/[id]/...` only.
 * Excludes `/user/bots`, `/user/bots/new` (no bot id after `new` in path).
 */
export function isAgentWorkspacePath(canonicalPath: string): boolean {
  return getBotIdFromPath(canonicalPath) !== null;
}

/**
 * Shell-only: compact main rail + agent sidebar. True **only** on `/user/bots/[id]/…` (real id).
 * False on workspace list, new bot, visitors, analytics, settings, dashboard — avoids agent chrome elsewhere.
 */
export function showAgentWorkspaceChrome(canonicalPath: string): boolean {
  return isAgentWorkspacePath(canonicalPath);
}

/** Prefix for bot URLs (supports super-admin / admin mirrors). */
export function getBotsBasePath(pathname: string): string {
  if (pathname.startsWith("/super-admin")) return "/super-admin/bots";
  if (pathname.startsWith("/admin")) return "/admin/bots";
  return "/user/bots";
}

/** Shown in the global header as the workspace label (no API name yet). */
export const WORKSPACE_DISPLAY_NAME = "Assistrio";

/** Home for the current app area (user / admin / super-admin). */
export function getWorkspaceHomeHref(pathname: string): string {
  if (pathname.startsWith("/super-admin")) return "/super-admin/bots";
  if (pathname.startsWith("/admin")) return "/admin/dashboard";
  return "/user/dashboard";
}

/** Workspace settings entry (general); super-admin uses user settings for account. */
export function getWorkspaceSettingsHref(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/admin/settings/general";
  return "/user/settings/general";
}

export function getUserAreaSegments(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "user") return parts.slice(1);
  if (parts[0] === "admin") return parts.slice(1);
  if (parts[0] === "super-admin") return parts.slice(1);
  return parts;
}
