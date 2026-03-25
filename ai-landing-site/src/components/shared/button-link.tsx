import Link from "next/link";
import type { CtaVariant } from "@/types/common";
import { cn } from "@/lib/cn";

type ButtonLinkProps = {
  href: string;
  label: string;
  variant?: CtaVariant;
  className?: string;
};

const base =
  "inline-flex items-center justify-center px-6 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-full";

const variants: Record<Exclude<CtaVariant, "link">, string> = {
  primary:
    "bg-brand text-white shadow-sm hover:bg-brand-hover focus-visible:outline-brand",
  secondary:
    "border border-neutral-200 bg-white text-neutral-900 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-neutral-400",
  ghost:
    "text-brand hover:bg-brand-muted/80 focus-visible:outline-brand px-5",
};

export function ButtonLink({
  href,
  label,
  variant = "primary",
  className,
}: ButtonLinkProps) {
  if (variant === "link") {
    return (
      <Link
        href={href}
        className={cn(
          "text-sm font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm",
          className,
        )}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link href={href} className={cn(base, variants[variant], className)}>
      {label}
    </Link>
  );
}

type ButtonLinkGroupProps = {
  items: Array<{
    label: string;
    href: string;
    variant?: CtaVariant;
  }>;
  className?: string;
};

export function ButtonLinkGroup({ items, className }: ButtonLinkGroupProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {items.map((item) => (
        <ButtonLink
          key={`${item.href}-${item.label}`}
          href={item.href}
          label={item.label}
          variant={item.variant ?? "primary"}
        />
      ))}
    </div>
  );
}
