import type { Metadata } from "next";
import { TrialSetupNavigationGate } from "@/components/trial/dashboard/trial-setup-navigation-gate";

export const metadata: Metadata = {
  title: "Setup",
};

export default function TrialDashboardSetupLayout({ children }: { children: React.ReactNode }) {
  return <TrialSetupNavigationGate>{children}</TrialSetupNavigationGate>;
}
