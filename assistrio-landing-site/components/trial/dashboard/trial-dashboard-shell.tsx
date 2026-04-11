"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SiteBrandLogoLink } from "@/components/layout/site-brand-logo";
import { TrialAgentSidebar } from "@/components/trial/dashboard/trial-agent-sidebar";
import { TrialDashboardIdentity } from "@/components/trial/dashboard/trial-dashboard-identity";
import { TrialWorkspaceLoadingCenter } from "@/components/trial/dashboard/trial-workspace-loading-center";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";

function cx(...c: Array<string | false | undefined>): string {
  return c.filter(Boolean).join(" ");
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]/35 focus-visible:ring-offset-2";

type Props = {
  children: ReactNode;
};

export function TrialDashboardShell({ children }: Props) {
  const pathname = usePathname();
  const isSetupWorkspace = pathname.startsWith("/trial/dashboard/setup");
  const isAgentWorkspaceArea =
    pathname.startsWith("/trial/dashboard/playground") || pathname.startsWith("/trial/dashboard/insights");
  const [mobileAgentOpen, setMobileAgentOpen] = useState(false);
  const { hydrated, hydrationError } = useTrialWorkspaceDraft();
  const showHydrationOverlay = !hydrated && !hydrationError;

  return (
    <div
      className="flex h-[100dvh] min-h-0 w-full flex-col bg-[#f4fbfb] text-slate-900 [--sidebar-expanded:clamp(216px,28vw,288px)] [--trial-header-h:3.5rem] sm:[--trial-header-h:4rem]"
    >
      <header className="sticky top-0 z-[60] w-full shrink-0 border-b border-[var(--border-default)] bg-white/92 shadow-[var(--shadow-xs)] backdrop-blur-md supports-[backdrop-filter]:bg-white/78">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--border-teal-soft)]/40 to-transparent" aria-hidden />
        <div className="flex w-full min-h-14 min-w-0 items-center justify-between gap-2 px-4 sm:h-16 sm:gap-4 sm:px-5 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <SiteBrandLogoLink
              title="Assistrio — marketing site home"
              className={cx("min-w-0 shrink-0", focusRing)}
            />

            <button
              type="button"
              className={cx(
                "-ml-1 shrink-0 rounded-lg p-2.5 text-slate-600 transition hover:bg-slate-100/90 lg:hidden",
                focusRing,
              )}
              aria-expanded={mobileAgentOpen}
              aria-controls="trial-agent-sidebar"
              onClick={() => setMobileAgentOpen((v) => !v)}
            >
              <span className="sr-only">Open agent workspace menu</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path strokeWidth="2" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>

          <div className="shrink-0">
            <TrialDashboardIdentity />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        <div
          className={cx(
            "relative flex min-h-0 min-w-0 flex-1",
            isAgentWorkspaceArea && !isSetupWorkspace && "lg:grid lg:gap-0 lg:[grid-template-columns:var(--sidebar-expanded)_minmax(0,1fr)]",
          )}
        >
          {mobileAgentOpen ? (
            <button
              type="button"
              className="fixed inset-x-0 bottom-0 top-[var(--trial-header-h)] z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden"
              aria-label="Close workspace menu"
              onClick={() => setMobileAgentOpen(false)}
            />
          ) : null}

          <TrialAgentSidebar mobileOpen={mobileAgentOpen} onNavigate={() => setMobileAgentOpen(false)} />

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-teal-200/40 bg-white/60 px-3 py-2 lg:hidden">
              <p className="text-xs font-medium text-slate-600">In this agent</p>
              <button
                type="button"
                onClick={() => setMobileAgentOpen(true)}
                className="rounded-md border border-teal-200/90 bg-teal-50/90 px-3 py-1.5 text-xs font-semibold text-[var(--brand-teal-dark)]"
              >
                Sections
              </button>
            </div>

            <div
              className={cx(
                "min-h-0 flex-1",
                isSetupWorkspace
                  ? "flex flex-col overflow-hidden"
                  : "overflow-y-auto overflow-x-clip bg-[#f4fbfb] px-4 py-5 sm:px-5 lg:px-7",
              )}
            >
              {isSetupWorkspace ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
              ) : (
                <div className="mx-auto flex min-h-0 w-full max-w-[min(1800px,100%)] flex-1 flex-col">{children}</div>
              )}
            </div>
          </div>

          {showHydrationOverlay ? (
            <div
              className="absolute inset-0 z-[55] flex flex-col bg-[#f4fbfb]/95 backdrop-blur-[2px]"
              aria-busy="true"
              aria-live="polite"
            >
              <TrialWorkspaceLoadingCenter message="Loading workspace…" variant="overlay" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
