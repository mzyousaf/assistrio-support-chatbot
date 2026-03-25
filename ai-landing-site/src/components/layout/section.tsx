import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SectionVariant = "default" | "subtle" | "accent";

type SectionProps = {
  id?: string;
  variant?: SectionVariant;
  children: ReactNode;
  className?: string;
  /** Extra padding for hero-like sections */
  spacious?: boolean;
};

const variantClass: Record<SectionVariant, string> = {
  default: "bg-white",
  subtle: "bg-neutral-50/80",
  accent:
    "bg-gradient-to-b from-brand-muted/60 via-white to-white border-y border-neutral-100/80",
};

export function Section({
  id,
  variant = "default",
  children,
  className,
  spacious = false,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        variantClass[variant],
        spacious
          ? "py-20 md:py-28 lg:py-32"
          : "py-16 md:py-20 lg:py-24",
        className,
      )}
    >
      {children}
    </section>
  );
}
