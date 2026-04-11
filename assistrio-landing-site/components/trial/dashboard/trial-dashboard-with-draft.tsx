"use client";

import type { ReactNode } from "react";
import { TrialDashboardShell } from "@/components/trial/dashboard/trial-dashboard-shell";
import { TrialDashboardToastProvider } from "@/components/trial/dashboard/trial-dashboard-toast";
import { TrialWorkspaceDraftProvider } from "@/components/trial/dashboard/trial-workspace-draft-context";

/**
 * Draft + shell must share one provider tree: sidebar reads draft before `/setup` layout mounts.
 */
export function TrialDashboardWithDraft({ children }: { children: ReactNode }) {
  return (
    <TrialDashboardToastProvider>
      <TrialWorkspaceDraftProvider>
        <TrialDashboardShell>{children}</TrialDashboardShell>
      </TrialWorkspaceDraftProvider>
    </TrialDashboardToastProvider>
  );
}
