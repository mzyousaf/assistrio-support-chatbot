"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import { getSetupWorkspaceNav } from "@/lib/trial/trial-setup-nav";
import {
  getTrialSetupStepIndex,
  isKnowledgeBaseMinimumContentMet,
  isSetupStepComplete,
  isTrialOnboardingComplete,
  TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS,
  type TrialSetupStepId,
} from "@/lib/trial/trial-workspace-draft";

const CREATING_PATH = "/trial/dashboard/setup/creating";

type Props = {
  stepId: TrialSetupStepId;
};

export function TrialSetupWorkspaceNav({ stepId }: Props) {
  const router = useRouter();
  const { draft, persistStepOnNext } = useTrialWorkspaceDraft();
  const nav = getSetupWorkspaceNav(stepId, draft);
  const i = getTrialSetupStepIndex(stepId);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <footer className="shrink-0 border-t border-slate-200/90 bg-white/95 shadow-[0_-1px_0_0_rgba(15,23,42,0.06),0_-16px_48px_-20px_rgba(15,23,42,0.12)] backdrop-blur-[8px]">
      <div className="px-5 py-4 sm:px-8 sm:py-4 lg:px-10">
        <div className="mx-auto flex w-full max-w-[min(100%,52rem)] flex-col gap-3">
          {stepId === "knowledge-base" && !isKnowledgeBaseMinimumContentMet(draft) ? (
            <p className="text-center text-[13px] leading-relaxed text-slate-600 sm:text-left">
              Add at least one file, 200+ characters of notes (max{" "}
              {TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS.toLocaleString()} characters), or one Q&amp;A pair (question and answer)
              to continue.
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-3 sm:gap-4">
            {nav.backPath ? (
              <Button
                type="button"
                variant="secondary"
                className="h-9 rounded-sm px-4 text-[13px]"
                disabled={isSaving}
                onClick={() => router.push(nav.backPath!)}
              >
                Back
              </Button>
            ) : null}
            <Button
              type="button"
              variant="primary"
              disabled={nav.forwardDisabled || isSaving}
              className="h-9 min-w-[7.25rem] rounded-sm px-6 text-[13px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(13,148,136,0.14)] transition hover:brightness-[1.02] active:scale-[0.99]"
              onClick={() => {
                void (async () => {
                  if (nav.forwardDisabled || isSaving) return;
                  setIsSaving(true);
                  try {
                    if (nav.forwardPath === CREATING_PATH) {
                      if (!isTrialOnboardingComplete(draft)) return;
                      const r = await persistStepOnNext(3, { finalizeToCreating: true });
                      if (!r.ok) {
                        return;
                      }
                      router.push(nav.forwardPath);
                      return;
                    }
                    const canLeaveStep =
                      (stepId === "knowledge-base" && isKnowledgeBaseMinimumContentMet(draft)) ||
                      (stepId !== "knowledge-base" && isSetupStepComplete(i, draft));
                    if (!canLeaveStep) return;
                    const r = await persistStepOnNext(i);
                    if (!r.ok) {
                      return;
                    }
                    router.push(nav.forwardPath);
                  } finally {
                    setIsSaving(false);
                  }
                })();
              }}
            >
              {isSaving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {nav.forwardPath === CREATING_PATH
                    ? "Continuing…"
                    : stepId === "knowledge-base"
                      ? "Going live…"
                      : "Saving…"}
                </span>
              ) : (
                nav.forwardLabel
              )}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
