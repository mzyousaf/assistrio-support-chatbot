import type { ReactNode } from "react";

const spacingClass = {
  default: "py-16 sm:py-24",
  compact: "py-12 sm:py-16",
  loose: "py-20 sm:py-28",
} as const;

const toneClass = {
  default: "",
  muted: "bg-slate-50/65",
  band: "border-b border-[var(--border-default)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/25 via-transparent to-transparent",
} as const;

export type SectionSpacing = keyof typeof spacingClass;
export type SectionTone = keyof typeof toneClass;

type Props = {
  children: ReactNode;
  id?: string;
  className?: string;
  spacing?: SectionSpacing;
  /** Subtle background treatments — compose with `className` for one-off hero gradients */
  tone?: SectionTone;
};

export function Section({
  children,
  id,
  className = "",
  spacing = "default",
  tone = "default",
}: Props) {
  /** Clears sticky site header + homepage subnav when present */
  const anchorOffset = id ? "scroll-mt-32" : "";
  return (
    <section id={id} className={`${anchorOffset} ${spacingClass[spacing]} ${toneClass[tone]} ${className}`}>
      {children}
    </section>
  );
}
