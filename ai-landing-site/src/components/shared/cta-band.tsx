import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { cn } from "@/lib/cn";

type CtaBandProps = {
  children: ReactNode;
  variant?: "solid" | "gradient";
  className?: string;
  innerClassName?: string;
};

export function CtaBand({
  children,
  variant = "solid",
  className,
  innerClassName,
}: CtaBandProps) {
  return (
    <div
      className={cn(
        variant === "gradient" &&
          "bg-gradient-to-br from-brand-muted/90 via-white to-brand-muted/40",
        variant === "solid" && "bg-neutral-50/90",
        "border-y border-neutral-100 py-14 md:py-16",
        className,
      )}
    >
      <Container>
        <div
          className={cn(
            "rounded-2xl border border-neutral-200/80 bg-white p-8 shadow-sm md:p-10 lg:p-12",
            innerClassName,
          )}
        >
          {children}
        </div>
      </Container>
    </div>
  );
}
