import type { Metadata } from "next";
import { TrialBehaviorStepBody } from "@/components/trial/dashboard/trial-behavior-step-body";
import { TrialSetupStepShell } from "@/components/trial/dashboard/trial-setup-step-shell";

export const metadata: Metadata = {
  title: "Describe Your AI Agent",
};

export default function TrialSetupDescribeAgentPage() {
  return (
    <TrialSetupStepShell stepId="describe-agent">
      <TrialBehaviorStepBody />
    </TrialSetupStepShell>
  );
}
