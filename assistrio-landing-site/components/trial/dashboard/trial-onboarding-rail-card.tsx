"use client";

import Link from "next/link";
import { CheckCircle2, ClipboardList } from "lucide-react";
import type { TrialWorkspaceDraftV3 } from "@/lib/trial/trial-workspace-draft";
import {
  getTrialSetupRailSegment,
  isTrialOnboardingComplete,
  maxUnlockedSetupStepIndex,
  TRIAL_SETUP_STEPS,
} from "@/lib/trial/trial-workspace-draft";

function cx(...c: Array<string | false | undefined>): string {
  return c.filter(Boolean).join(" ");
}

type Props = {
  draft: TrialWorkspaceDraftV3;
  hydrated: boolean;
  hasTrialAgent: boolean;
  pathname: string;
};

/** Compact sidebar onboarding status — minimal footprint. */
export function TrialOnboardingRailCard({ draft, hydrated, hasTrialAgent, pathname }: Props) {
  const onboardingComplete = isTrialOnboardingComplete(draft);
  const totalSteps = TRIAL_SETUP_STEPS.length;
  const maxIdx = maxUnlockedSetupStepIndex(draft);
  const latestUnlocked = Math.min(totalSteps, maxIdx + 1);
  const creating = pathname.includes("/setup/creating");
  const setupContinueHref = TRIAL_SETUP_STEPS[Math.min(maxIdx, TRIAL_SETUP_STEPS.length - 1)]!.path;

  const microBar = (
    <div className="mt-1.5 flex gap-0.5" aria-hidden>
      {TRIAL_SETUP_STEPS.map((_, i) => {
        const seg = getTrialSetupRailSegment(i, draft, { hydrated });
        return (
          <div
            key={TRIAL_SETUP_STEPS[i]!.id}
            className={cx(
              "h-1 min-w-0 flex-1 rounded-full",
              seg === "done" && "bg-emerald-400",
              seg === "error" && "bg-red-400",
              seg === "teal" && "bg-[var(--brand-teal)]",
              seg === "muted" && "bg-slate-200/90",
            )}
          />
        );
      })}
    </div>
  );

  if (hasTrialAgent && !onboardingComplete && !creating) {
    return (
      <div className="mb-3 rounded-lg border border-amber-200/70 bg-amber-50/50 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/85">Onboarding</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-800">Finish setup in draft</p>
        <Link href={setupContinueHref} className="mt-1 inline-block text-[10px] font-semibold text-[var(--brand-teal-dark)] hover:underline">
          Open setup →
        </Link>
      </div>
    );
  }

  if (hasTrialAgent && onboardingComplete && !creating) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/35 px-2.5 py-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden />
        <p className="text-[11px] font-medium leading-snug text-emerald-950">Setup complete</p>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
          <span className="truncate text-[11px] font-medium text-slate-800">Onboarding</span>
        </div>
        <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-500">
          {creating ? `${totalSteps}/${totalSteps}` : `${latestUnlocked}/${totalSteps}`}
        </span>
      </div>
      {microBar}
      {!hasTrialAgent ? (
        <Link
          href={setupContinueHref}
          className="mt-1.5 block text-center text-[10px] font-semibold text-[var(--brand-teal-dark)] hover:underline"
        >
          Continue
        </Link>
      ) : null}
    </div>
  );
}
