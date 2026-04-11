"use client";

import type { ReactNode } from "react";
import { TrialSetupWorkspaceNav } from "@/components/trial/dashboard/trial-setup-workspace-nav";
import type { TrialSetupStepId } from "@/lib/trial/trial-workspace-draft";

type Props = {
  stepper: ReactNode | null;
  /** When set with stepper, bottom Back / Next bar is shown */
  stepId?: TrialSetupStepId;
  /** Full-width finalize (creating) — optional title area */
  finalizeTitle?: string;
  finalizeDescription?: string;
  children: ReactNode;
};

/**
 * Full-height split workspace: tinted workflow rail (left) + white editor (right).
 * Right pane scrolls; rail stays visible on large screens.
 */
export function TrialSetupEditorPane({ stepper, stepId, finalizeTitle, finalizeDescription, children }: Props) {
  if (!stepper) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white">
        {(finalizeTitle || finalizeDescription) && (
          <header className="shrink-0 border-b border-slate-100 px-8 py-8 sm:px-10 sm:py-10">
            {finalizeTitle ? (
              <h1 className="font-[family-name:var(--font-display)] text-[1.5rem] font-semibold tracking-[-0.02em] text-slate-900">
                {finalizeTitle}
              </h1>
            ) : null}
            {finalizeDescription ? (
              <p className="mt-3 max-w-2xl text-[0.9375rem] leading-relaxed text-slate-600">{finalizeDescription}</p>
            ) : null}
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 sm:px-10 sm:pb-12">
          <div className="mx-auto w-full max-w-[min(100%,52rem)]">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden lg:flex-row">
      <aside className="flex max-h-[min(44vh,24rem)] min-h-0 w-full shrink-0 flex-col overflow-y-auto overscroll-contain border-b border-slate-200/55 bg-gradient-to-b from-teal-50/35 via-slate-50/40 to-slate-50/25 shadow-[inset_-1px_0_0_0_rgba(15,23,42,0.05)] lg:max-h-none lg:min-h-0 lg:w-[clamp(200px,20vw,260px)] lg:min-w-[min(100%,200px)] lg:max-w-[260px] lg:flex-shrink-0 lg:self-stretch lg:border-b-0 lg:border-r lg:border-slate-200/50">
        <div className="px-4 py-6 sm:px-5 sm:py-7 lg:px-4 lg:py-8">{stepper}</div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,#fafafa_0%,#ffffff_12%)] shadow-[inset_0_1px_0_0_rgba(15,23,42,0.04)]">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-[min(100%,52rem)]">{children}</div>
        </div>
        {stepId ? <TrialSetupWorkspaceNav stepId={stepId} /> : null}
      </div>
    </div>
  );
}
