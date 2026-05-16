"use client";

import type { ReactNode } from "react";
import { buttonBaseClass, buttonVariantClass, type ButtonVariant } from "@/components/ui/button";
import { useTrackEvent } from "@/hooks/useTrackEvent";

type Props = {
  href: string;
  children: ReactNode;
  location: string;
  label: string;
  variant?: ButtonVariant;
  className?: string;
  useButtonChrome?: boolean;
  /** e.g. pass-through Google OAuth or customer app entry */
  rel?: string;
};

/**
 * Same analytics shape as {@link TrackedCtaLink}, for cross-origin URLs (API OAuth start, customer app).
 */
export function TrackedExternalCtaLink({
  href,
  children,
  location,
  label,
  variant = "primary",
  className = "",
  useButtonChrome = true,
  rel,
}: Props) {
  const { track } = useTrackEvent();
  const chrome = useButtonChrome ? `${buttonBaseClass} ${buttonVariantClass[variant]}` : "";
  return (
    <a
      href={href}
      rel={rel ?? "noopener noreferrer"}
      className={`${chrome} ${className}`.trim()}
      onClick={() => track("cta_clicked", { location, label, href })}
    >
      {children}
    </a>
  );
}
