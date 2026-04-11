import type { Metadata } from "next";
import { TrialCreatingAgentStepBody } from "@/components/trial/dashboard/trial-creating-agent-step-body";
import { TrialSetupStepShell } from "@/components/trial/dashboard/trial-setup-step-shell";

export const metadata: Metadata = {
  title: "Creating AI Agent",
};

export default function TrialSetupCreatingPage() {
  return (
    <TrialSetupStepShell
      hideStepper
      fallbackTitle="Create your AI Agent"
      fallbackDescription="Sit tight—this screen is where you’ll see your AI Agent come to life. Full live progress arrives in the next release."
    >
      <TrialCreatingAgentStepBody />
    </TrialSetupStepShell>
  );
}
