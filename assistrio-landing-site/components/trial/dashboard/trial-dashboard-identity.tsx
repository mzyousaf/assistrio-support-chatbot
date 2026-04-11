"use client";

import { TrialSessionAccountMenu } from "@/components/trial/trial-session-account-menu";
import { useTrialDashboardSession } from "@/components/trial/dashboard/trial-dashboard-session-context";

export function TrialDashboardIdentity() {
  const session = useTrialDashboardSession();

  return (
    <TrialSessionAccountMenu
      variant="dashboard"
      session={{
        initials: session.initials,
        displayName: session.displayName,
        emailNormalized: session.emailNormalized,
        workspaceIdLabel: `aw_${session.platformVisitorId}`,
      }}
    />
  );
}
