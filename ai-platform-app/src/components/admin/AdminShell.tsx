"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

interface AdminShellProps {
  title?: string;
  children: React.ReactNode;
  /** When true, main content uses full width (no max-w-6xl). */
  fullWidth?: boolean;
}

const navItems = [
  { href: "/super-admin/dashboard", label: "Dashboard" },
  { href: "/super-admin/bots", label: "Bots" },
  { href: "/super-admin/visitors", label: "Visitors" },
  { href: "/super-admin/analytics", label: "Analytics" },
  { href: "/super-admin/settings/limits", label: "Settings" },
];

function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) {
    return true;
  }

  if (href === "/super-admin/settings/limits") {
    return pathname.startsWith("/super-admin/settings");
  }

  return pathname.startsWith(`${href}/`);
}

function cx(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}

const breadcrumbLabels: Record<string, string> = {
  dashboard: "Dashboard",
  bots: "Bots",
  visitors: "Visitors",
  analytics: "Analytics",
  settings: "Settings",
  limits: "Limits",
  login: "Login",
  new: "New",
};

function formatBreadcrumbLabel(segment: string): string {
  if (breadcrumbLabels[segment]) {
    return breadcrumbLabels[segment];
  }

  // Treat likely IDs as details pages.
  if (/^[a-f0-9]{8,}$/i.test(segment) || /^[0-9a-f-]{8,}$/i.test(segment)) {
    return "Details";
  }

  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AdminShell({ title, children, fullWidth }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const pathSegments = pathname.split("/").filter(Boolean);
  const adminSegments = pathSegments[0] === "super-admin" ? pathSegments.slice(1) : pathSegments;
  const breadcrumbs = adminSegments.map((segment, index) => {
    const href = `/super-admin/${adminSegments.slice(0, index + 1).join("/")}`;
    const isLast = index === adminSegments.length - 1;
    const label = isLast && title ? title : formatBreadcrumbLabel(segment);
    return { href, label, isLast };
  });
  const isDashboardPage = pathname === "/super-admin/dashboard";
  const parentBreadcrumb = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;
  const backFallbackHref = parentBreadcrumb?.href ?? "/super-admin/dashboard";
  const backLabel = parentBreadcrumb ? `Back to ${parentBreadcrumb.label}` : "Back to Dashboard";

  useEffect(() => {
    const saved = localStorage.getItem("admin_theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      return;
    }

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("admin_theme", next);
      return next;
    });
  }

  async function handleLogout() {
    await apiFetch("/api/super-admin/logout", { method: "POST" });
    router.push("/super-admin/login");
  }

  function handleBack() {
    const referrer = document.referrer;
    const sameOrigin = referrer.startsWith(window.location.origin);
    const fromAdminArea = referrer.includes("/super-admin");
    if (window.history.length > 1 && sameOrigin && fromAdminArea) {
      router.back();
      return;
    }
    router.push(backFallbackHref);
  }

  return (
    <div className={cx(theme === "dark" && "dark", "admin-theme min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex font-body")}>
      <aside className="hidden md:flex flex-col w-64 border-r border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur shadow-card">
        <div className="h-16 flex items-center px-5 border-b border-gray-200 dark:border-gray-800">
          <div className="h-9 w-9 rounded-xl bg-brand-50 dark:bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-300 font-semibold shadow-card ring-1 ring-brand-100 dark:ring-brand-500/30">
            AI
          </div>
          <div className="ml-3">
            <div className="text-sm font-heading font-semibold text-gray-900 dark:text-gray-100">Assistrio AI</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Super Admin</div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 text-sm">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                className={cx(
                  "flex items-center px-3 py-2 rounded-xl text-sm transition-colors border-l-4",
                  active
                    ? "bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 font-semibold border-brand-500 dark:border-brand-400 shadow-card"
                    : "border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100",
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-20 min-h-16 flex items-center justify-between px-4 md:px-8 py-2 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
          <div className="min-w-0 flex items-center gap-2 md:gap-3">
            {!isDashboardPage ? (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                aria-label={backLabel}
                title={backLabel}
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15 18l-6-6 6-6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            ) : null}

            <div className="min-w-0">
              {breadcrumbs.length > 0 ? (
                <nav aria-label="Breadcrumb" className="mb-0.5 overflow-x-auto">
                  <ol className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    <li>
                      <Link href="/super-admin/dashboard" className="hover:text-brand-600 dark:hover:text-brand-300 transition-colors">
                        Dashboard
                      </Link>
                    </li>
                    {breadcrumbs.map((crumb) => (
                      <li key={crumb.href} className="flex items-center gap-1.5">
                        <span aria-hidden="true">›</span>
                        {crumb.isLast ? (
                          <span className="text-gray-700 dark:text-gray-200">{crumb.label}</span>
                        ) : (
                          <Link href={crumb.href} className="hover:text-brand-600 dark:hover:text-brand-300 transition-colors">
                            {crumb.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ol>
                </nav>
              ) : null}
              {title ? (
                <h1 className="truncate text-base md:text-lg font-heading font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={toggleTheme}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </Button>
            <span className="hidden sm:inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              Super Admin
            </span>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        <nav className="md:hidden border-b border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70">
          <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                    active
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 px-4 md:px-8 py-6 flex flex-col min-h-0">
          <div className={cx("flex-1 min-h-0", fullWidth ? "w-full max-w-none flex flex-col" : "max-w-6xl mx-auto space-y-6")}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
