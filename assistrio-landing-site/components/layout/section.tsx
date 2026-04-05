import type { ReactNode } from "react";

const spacingClass = {
  /** Default homepage rhythm — slightly roomier than compact marketing pages */
  default: "py-20 sm:py-28",
  compact: "py-12 sm:py-16",
  loose: "py-24 sm:py-36",
  /** Tighter band for dense editorial blocks (e.g. pricing prelude) */
  snug: "py-14 sm:py-20",
  /** Vertical padding supplied entirely via `className` (e.g. hero) */
  none: "",
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
  /** Section is at least one viewport tall (content can grow beyond). */
  fillViewport?: boolean;
};

export function Section({
  children,
  id,
  className = "",
  spacing = "default",
  tone = "default",
  fillViewport = false,
}: Props) {
  /** Clears sticky site header when jumping to in-page anchors */
  const anchorOffset = id ? "scroll-mt-24 sm:scroll-mt-28" : "";
  /** Full viewport bands with content vertically centered when shorter than the viewport */
  const fillClass = fillViewport ? "min-h-[100svh] flex flex-col justify-center" : "";
  return (
    <section
      id={id}
      className={`${anchorOffset} ${spacingClass[spacing]} ${toneClass[tone]} ${fillClass} ${className}`.trim()}
    >
      {children}
    </section>
  );
}
