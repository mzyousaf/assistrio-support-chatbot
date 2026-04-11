"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import type { TrialSessionClientPayload } from "@/lib/trial/trial-session-display";

function isTrialDashboardPath(pathname: string): boolean {
  return pathname === "/trial/dashboard" || pathname.startsWith("/trial/dashboard/");
}

type Props = {
  children: ReactNode;
  trialSessionClient: TrialSessionClientPayload | null;
};

/**
 * Marketing header/footer must follow the **URL**, not a cached root layout.
 * Client-side navigation from `/trial/dashboard` → `/` would otherwise keep chrome hidden
 * if we only used middleware request headers in the server layout.
 */
export function RootMarketingChrome({ children, trialSessionClient }: Props) {
  const pathname = usePathname() ?? "";
  const hideMarketing = isTrialDashboardPath(pathname);
  const workspaceMain = hideMarketing;

  return (
    <>
      {!hideMarketing ? <SiteHeader trialSessionClient={trialSessionClient} /> : null}
      <main
        className={
          workspaceMain
            ? "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
            : "flex min-h-0 w-full min-w-0 flex-1 flex-col"
        }
      >
        {children}
      </main>
      {!hideMarketing ? <SiteFooter /> : null}
    </>
  );
}
