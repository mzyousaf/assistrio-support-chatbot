"use client";

import { TrialSetupSectionHeader } from "@/components/trial/dashboard/trial-setup-section-header";
import { TrialTextInput } from "@/components/trial/dashboard/trial-forms/trial-text-input";
import { StepInfoButton } from "@/components/trial/dashboard/trial-onboarding-stepper";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import { getTrialSetupStepConfig } from "@/lib/trial/trial-workspace-draft";

export function TrialAllowedWebsiteStepBody() {
  const { draft, setAllowedWebsite } = useTrialWorkspaceDraft();
  const section = getTrialSetupStepConfig("go-live");

  return (
    <div className="space-y-10 pb-2">
      <TrialSetupSectionHeader
        compactBottom
        title={section.editorTitle}
        description={section.editorDescription}
        trailing={<StepInfoButton label={section.editorTitle} body={section.infoBody} />}
      />

      <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Your website</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          This is the site where visitors will open the chat and talk to your AI Agent. Start with the address people already use to find
          you—you can add more places later.
        </p>
        <div className="mt-6">
          <TrialTextInput
            id="tw-allowed-site"
            label={
              <>
                Primary website <span className="text-red-600">*</span>
              </>
            }
            type="url"
            inputMode="url"
            value={draft.allowedWebsite}
            onChange={(e) => setAllowedWebsite(e.target.value)}
            placeholder="https://www.yourcompany.com"
            maxLength={500}
            autoComplete="url"
            hint="Use the same site where you’ll add the chat. Needed before you can create your AI Agent."
          />
        </div>
      </section>
    </div>
  );
}
