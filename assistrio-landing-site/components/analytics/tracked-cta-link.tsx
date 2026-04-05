"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonBaseClass, buttonVariantClass, type ButtonVariant } from "@/components/ui/button";
import { useTrackEvent } from "@/hooks/useTrackEvent";

type Props = {
  href: string;
  children: ReactNode;
  /** Logical placement for `cta_clicked` metadata. */
  location: string;
  /** Human-readable CTA name for analytics. */
  label: string;
  variant?: ButtonVariant;
  className?: string;
};

export function TrackedCtaLink({
  href,
  children,
  location,
  label,
  variant = "primary",
  className = "",
}: Props) {
  const { track } = useTrackEvent();
  return (
    <Link
      href={href}
      onClick={() => track("cta_clicked", { location, label, href })}
      className={`${buttonBaseClass} ${buttonVariantClass[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
