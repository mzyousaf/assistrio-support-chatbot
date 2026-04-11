import type { Metadata } from "next";
import { TrialProfileStepBody } from "@/components/trial/dashboard/trial-profile-step-body";
import { TrialSetupStepShell } from "@/components/trial/dashboard/trial-setup-step-shell";

export const metadata: Metadata = {
  title: "Profile",
};

export default function TrialSetupProfilePage() {
  return (
    <TrialSetupStepShell stepId="profile">
      <TrialProfileStepBody />
    </TrialSetupStepShell>
  );
}
