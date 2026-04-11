"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  /** Optional control beside the title (e.g. StepInfoButton). */
  trailing?: ReactNode;
  /** Tighter bottom rhythm before the first form section (e.g. Profile → Identity & Branding). */
  compactBottom?: boolean;
};

/**
 * Primary heading for the active setup step form (centered column).
 */
export function TrialSetupSectionHeader({ title, description, trailing, compactBottom }: Props) {
  const edge = compactBottom ? "mb-5 border-b border-slate-200/80 pb-5" : "mb-8 border-b border-slate-200/80 pb-7";
  return (
    <header className={`${edge} shadow-[0_1px_0_0_rgba(255,255,255,0.8)]`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h1 className="min-w-0 flex-1 font-[family-name:var(--font-display)] text-[1.375rem] font-semibold tracking-[-0.025em] text-slate-950 sm:text-[1.5rem]">
          {title}
        </h1>
        {trailing ? <div className="shrink-0 pt-1">{trailing}</div> : null}
      </div>
      {description ? (
        <p className="mt-1 max-w-[52rem] text-[13px] leading-relaxed text-slate-500/85">{description}</p>
      ) : null}
    </header>
  );
}
