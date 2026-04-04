import type { ReactNode } from "react";

type Props = {
  step: string;
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
};

/** Numbered section for /trial — onboarding rhythm without hiding product caveats. */
export function TrialFlowStep({ step, title, description, children, id }: Props) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex flex-col gap-1 border-b border-[var(--border-default)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-teal-subtle)] text-sm font-bold tabular-nums text-[var(--brand-teal-dark)] shadow-[var(--shadow-xs)] ring-1 ring-[var(--border-teal-soft)]"
            aria-hidden
          >
            {step}
          </span>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
