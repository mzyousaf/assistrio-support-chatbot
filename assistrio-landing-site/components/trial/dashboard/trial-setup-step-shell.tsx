"use client";

import type { ReactNode } from "react";
import { TrialOnboardingStepper } from "@/components/trial/dashboard/trial-onboarding-stepper";
import { TrialSetupEditorPane } from "@/components/trial/dashboard/trial-setup-editor-pane";
import type { TrialSetupStepId } from "@/lib/trial/trial-workspace-draft";

type Props = {
  stepId?: TrialSetupStepId;
  hideStepper?: boolean;
  fallbackTitle?: string;
  fallbackDescription?: string;
  children: ReactNode;
};

export function TrialSetupStepShell({
  stepId,
  hideStepper,
  fallbackTitle = "",
  fallbackDescription = "",
  children,
}: Props) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <TrialSetupEditorPane
        stepper={hideStepper || !stepId ? null : <TrialOnboardingStepper activeStepId={stepId} />}
        stepId={hideStepper || !stepId ? undefined : stepId}
        finalizeTitle={hideStepper ? fallbackTitle : undefined}
        finalizeDescription={hideStepper ? fallbackDescription : undefined}
      >
        {children}
      </TrialSetupEditorPane>
    </div>
  );
}
