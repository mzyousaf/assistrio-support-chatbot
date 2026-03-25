import type { SectionHeaderAlign } from "@/types/common";
import { cn } from "@/lib/cn";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  description?: string;
  align?: SectionHeaderAlign;
  className?: string;
};

export function SectionHeader({
  title,
  subtitle,
  description,
  align = "left",
  className,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <h2
        className={cn(
          "text-balance text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl",
          align === "center" && "mx-auto",
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "mt-4 text-lg leading-relaxed text-neutral-600 sm:text-xl",
            align === "center" && "mx-auto max-w-2xl",
          )}
        >
          {subtitle}
        </p>
      ) : null}
      {description ? (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed text-neutral-600 sm:max-w-2xl",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
