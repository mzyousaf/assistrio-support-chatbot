"use client";

import { useCallback, useMemo } from "react";
import { TrialSetupSectionHeader } from "@/components/trial/dashboard/trial-setup-section-header";
import { TrialTextarea } from "@/components/trial/dashboard/trial-forms/trial-textarea";
import { StepInfoButton } from "@/components/trial/dashboard/trial-onboarding-stepper";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import {
  getTrialSetupStepConfig,
  mapUnifiedDescriptionToBehaviorFields,
  type TrialWorkspaceBehavior,
} from "@/lib/trial/trial-workspace-draft";

function composeLegacyBehaviorDisplay(b: TrialWorkspaceBehavior): string {
  if (b.whatAgentDoes.trim()) return b.whatAgentDoes;
  const parts: string[] = [];
  if (b.tone.trim()) parts.push(`Tone: ${b.tone}`);
  if (b.audience.trim()) parts.push(`Audience: ${b.audience}`);
  if (b.responseStyle.trim()) parts.push(`Response style: ${b.responseStyle}`);
  if (b.exampleResponsibilities.trim()) parts.push(`Key responsibilities:\n${b.exampleResponsibilities}`);
  return parts.join("\n\n");
}

const PLACEHOLDER = `Example: Help visitors book demos, answer pricing questions, and collect leads. Keep replies friendly and short. If you’re not sure about policy, offer to connect a human.`;

export function TrialBehaviorStepBody() {
  const { draft, setBehavior } = useTrialWorkspaceDraft();
  const b = draft.behavior;
  const section = getTrialSetupStepConfig("describe-agent");

  const displayValue = useMemo(() => composeLegacyBehaviorDisplay(b), [b]);

  const onUnifiedChange = useCallback(
    (raw: string) => {
      setBehavior(mapUnifiedDescriptionToBehaviorFields(raw, b));
    },
    [b, setBehavior],
  );

  return (
    <div className="space-y-10 pb-2">
      <TrialSetupSectionHeader
        compactBottom
        title={section.editorTitle}
        description={section.editorDescription}
        trailing={<StepInfoButton label={section.editorTitle} body={section.infoBody} />}
      />

      <TrialTextarea
        id="tw-behavior-unified"
        label={
          <>
            AI Agent description <span className="text-red-600">*</span>
          </>
        }
        className="min-h-[14rem] sm:min-h-[16rem]"
        value={displayValue}
        onChange={(e) => onUnifiedChange(e.target.value)}
        placeholder={PLACEHOLDER}
        maxLength={4000}
        hint={`${displayValue.length.toLocaleString()} / 4,000 characters. More detail here means clearer, more helpful answers.`}
      />
    </div>
  );
}
