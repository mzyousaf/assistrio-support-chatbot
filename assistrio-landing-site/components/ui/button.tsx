import Link from "next/link";
import type { ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

type Variant = ButtonVariant;

export const buttonBaseClass =
  "inline-flex items-center justify-center rounded-[var(--radius-lg)] px-5 py-2.5 text-sm font-semibold transition-[color,background-color,box-shadow,transform,filter] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const base = buttonBaseClass;

export const buttonVariantClass: Record<Variant, string> = {
  primary:
    "bg-[var(--brand-teal)] text-white shadow-[var(--shadow-sm)] ring-1 ring-white/15 hover:bg-[var(--brand-teal-hover)] hover:shadow-[0_14px_42px_-12px_rgba(13,148,136,0.42)] hover:brightness-[1.02] active:shadow-[var(--shadow-xs)] active:brightness-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]",
  secondary:
    "border border-[var(--border-teal-soft)] bg-white text-[var(--brand-teal-dark)] shadow-[var(--shadow-xs)] hover:border-[var(--brand-teal)]/45 hover:bg-[var(--brand-teal-subtle)]/85 hover:shadow-[var(--shadow-md)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)]/50",
  ghost:
    "text-[var(--foreground-muted)] hover:bg-slate-100/90 hover:text-[var(--foreground)] hover:shadow-[var(--shadow-xs)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400/60",
};

const variantClass = buttonVariantClass;

type ButtonProps = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
};

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  disabled,
  onClick,
}: ButtonProps) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${variantClass[variant]} ${className}`}>
      {children}
    </button>
  );
}

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
};

export function ButtonLink({ href, children, variant = "primary", className = "" }: ButtonLinkProps) {
  return (
    <Link href={href} className={`${base} ${variantClass[variant]} ${className}`}>
      {children}
    </Link>
  );
}
