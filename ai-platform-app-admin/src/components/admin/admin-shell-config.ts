import type { LucideIcon } from "lucide-react";
import { BarChart3, Bot, Building2 } from "lucide-react";

export type MainNavId = "bots" | "analytics" | "settings";

export interface MainNavItem {
  id: MainNavId;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Highlight when pathname matches canonical `/admin/...` path. */
  isActive: (canonicalPath: string) => boolean;
  children?: { label: string; href: string }[];
}

/**
 * Primary internal navigation — all routes under `/admin/*`.
 * Labels describe operator / platform scope, not the customer product.
 */
export const MAIN_SIDEBAR: MainNavItem[] = [
  {
    id: "bots",
    label: "Bots & showcase",
    href: "/admin/bots",
    icon: Bot,
    isActive: (p) => p.startsWith("/admin/bots") || p.startsWith("/admin/visitors"),
  },
  {
    id: "analytics",
    label: "Global analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    isActive: (p) => p.startsWith("/admin/analytics"),
    children: [
      { label: "Overview", href: "/admin/analytics" },
      { label: "Chats", href: "/admin/analytics/chats" },
      { label: "Topics", href: "/admin/analytics/topics" },
      { label: "Sentiment", href: "/admin/analytics/sentiment" },
    ],
  },
  {
    id: "settings",
    label: "Platform settings",
    href: "/admin/settings/general",
    icon: Building2,
    isActive: (p) => p.startsWith("/admin/settings"),
    children: [
      { label: "General", href: "/admin/settings/general" },
      { label: "Members", href: "/admin/settings/members" },
      { label: "Plans", href: "/admin/settings/plans" },
      { label: "Billing", href: "/admin/settings/billing" },
      { label: "API Keys", href: "/admin/settings/api-keys" },
    ],
  },
];

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

  if (p === "/admin/dashboard") return "Overview";
  if (p === "/admin/bots/new") return "Create bot";
  if (p === "/admin/bots") return "Bots & showcase";
  if (p === "/admin/visitors" || p.startsWith("/admin/visitors/")) return "Visitors";

  for (const item of MAIN_SIDEBAR) {
    if (p === item.href) return item.label;
  }

  return undefined;
}

/**
 * Normalize pathname to canonical `/admin/...` for nav matching (handles bookmark redirects still using
 * historical `/user` or `/super-admin` prefixes in memory — live routes are `/admin/*` only).
 */
export function getCanonicalUserPath(pathname: string): string {
  if (pathname.startsWith("/admin")) {
    return pathname;
  }
  if (pathname.startsWith("/super-admin")) {
    return `/admin${pathname.slice("/super-admin".length)}`;
  }
  if (pathname.startsWith("/user")) {
    return `/admin${pathname.slice("/user".length)}`;
  }
  return pathname;
}

export function getBotIdFromPath(canonicalPath: string): string | null {
  const p = canonicalPath.split("?")[0];
  const m = /^\/admin\/bots\/([^/]+)/.exec(p);
  if (!m) return null;
  const id = m[1];
  if (id === "new") return null;
  return id;
}

export function isAgentWorkspacePath(canonicalPath: string): boolean {
  return getBotIdFromPath(canonicalPath) !== null;
}

export function showAgentWorkspaceChrome(canonicalPath: string): boolean {
  return isAgentWorkspacePath(canonicalPath);
}

/** Bot URLs always use the internal `/admin/bots` namespace. */
export function getBotsBasePath(_pathname?: string): string {
  return "/admin/bots";
}

/** Shown in the global header — internal ops shell, not the customer workspace. */
export const WORKSPACE_DISPLAY_NAME = "Assistrio · Ops";

export function getWorkspaceHomeHref(_pathname: string): string {
  return "/admin/dashboard";
}

export function getWorkspaceSettingsHref(_pathname: string): string {
  return "/admin/settings/general";
}

/** Path segments after the top-level app prefix (`admin`, or legacy `user` / `super-admin` in client history). */
export function getUserAreaSegments(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "user" || parts[0] === "admin" || parts[0] === "super-admin") {
    return parts.slice(1);
  }
  return parts;
}
