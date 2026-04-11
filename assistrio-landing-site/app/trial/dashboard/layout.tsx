import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TrialDashboardSessionProvider } from "@/components/trial/dashboard/trial-dashboard-session-context";
import { TrialDashboardWithDraft } from "@/components/trial/dashboard/trial-dashboard-with-draft";
import { validateTrialDashboardSession } from "@/lib/server/trial-session";
import { buildTrialSessionClientPayload } from "@/lib/trial/trial-session-display";

export const metadata: Metadata = {
  title: "Trial workspace",
  robots: { index: false, follow: false },
};

export default async function TrialDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await validateTrialDashboardSession();
  if (!session) {
    redirect("/trial/verify?reason=session&expired=1");
  }

  const badge = buildTrialSessionClientPayload(session);
  const serial = {
    emailNormalized: session.emailNormalized,
    platformVisitorId: session.platformVisitorId,
    sessionExpiresAt: session.sessionExpiresAt,
    displayName: badge.displayName,
    initials: badge.initials,
  };

  return (
    <TrialDashboardSessionProvider value={serial}>
      <TrialDashboardWithDraft>{children}</TrialDashboardWithDraft>
    </TrialDashboardSessionProvider>
  );
}
