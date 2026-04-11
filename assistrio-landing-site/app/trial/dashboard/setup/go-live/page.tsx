import type { Metadata } from "next";
import { TrialAllowedWebsiteStepBody } from "@/components/trial/dashboard/trial-allowed-website-step-body";
import { TrialSetupStepShell } from "@/components/trial/dashboard/trial-setup-step-shell";

export const metadata: Metadata = {
  title: "Go Live",
};

export default function TrialSetupGoLivePage() {
  return (
    <TrialSetupStepShell stepId="go-live">
      <TrialAllowedWebsiteStepBody />
    </TrialSetupStepShell>
  );
}
