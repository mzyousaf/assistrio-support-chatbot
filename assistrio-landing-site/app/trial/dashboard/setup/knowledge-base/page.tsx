import type { Metadata } from "next";
import { Suspense } from "react";
import { TrialKnowledgeBaseStepBody } from "@/components/trial/dashboard/trial-knowledge-base-step-body";
import { TrialSetupStepShell } from "@/components/trial/dashboard/trial-setup-step-shell";

export const metadata: Metadata = {
  title: "Knowledge base",
};

export default function TrialSetupKnowledgeBasePage() {
  return (
    <TrialSetupStepShell stepId="knowledge-base">
      <Suspense
        fallback={
          <div className="rounded-xl border border-[var(--border-default)] bg-white p-8 text-sm text-[var(--foreground-muted)]">
            Loading your knowledge base…
          </div>
        }
      >
        <TrialKnowledgeBaseStepBody />
      </Suspense>
    </TrialSetupStepShell>
  );
}
