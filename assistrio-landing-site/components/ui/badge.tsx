import type { ReactNode } from "react";

type Tone = "teal" | "neutral";

const toneClass: Record<Tone, string> = {
  teal: "border border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/90 text-[var(--brand-teal-dark)] shadow-[var(--shadow-xs)]",
  neutral: "border border-[var(--border-default)] bg-white text-slate-600 shadow-[var(--shadow-xs)]",
};

type Props = {
  children: ReactNode;
  className?: string;
  tone?: Tone;
};

export function Badge({ children, className = "", tone = "teal" }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-tight ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
