import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  className?: string;
  /** Optional anchor id for in-page navigation */
  id?: string;
};

/** Shared section title block for homepage — matches PageIntro rhythm without duplicating layout primitives. */
export function HomeSectionHeader({ eyebrow, title, children, className = "", id }: Props) {
  return (
    <div id={id} className={`max-w-2xl scroll-mt-32 ${className}`}>
      {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
      <h2 className={`font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl ${eyebrow ? "mt-3" : ""}`}>
        {title}
      </h2>
      {children ? <div className="mt-3 text-[var(--foreground-muted)]">{children}</div> : null}
    </div>
  );
}
