"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  /** `section` = step subheading (below page title); `label` = small uppercase rail; `heading` = compact emphasis. */
  titleVariant?: "section" | "label" | "heading";
  /** e.g. info icon after the title */
  trailing?: ReactNode;
  /** Right-aligned control in the header row (e.g. Add shortcut). */
  headerEnd?: ReactNode;
  children: ReactNode;
};

/**
 * Visual grouping for trial setup forms — whitespace + title hierarchy (no heavy borders).
 */
export function TrialFormSection({ title, description, titleVariant = "section", trailing, headerEnd, children }: Props) {
  const titleClass =
    titleVariant === "label"
      ? "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500"
      : titleVariant === "heading"
        ? "text-[0.9375rem] font-medium tracking-tight text-slate-800"
        : "text-[1.0625rem] font-medium tracking-[-0.015em] text-slate-800 sm:text-[1.125rem]";

  const headingBlock = (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <h2 className={titleClass}>{title}</h2>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
      </div>
      {description ? <p className="max-w-2xl text-[12px] leading-relaxed text-slate-500/70">{description}</p> : null}
    </div>
  );

  return (
    <section className="space-y-4">
      {headerEnd ? (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {headingBlock}
          <div className="shrink-0 sm:pt-0.5">{headerEnd}</div>
        </div>
      ) : (
        <div>{headingBlock}</div>
      )}
      {children}
    </section>
  );
}
