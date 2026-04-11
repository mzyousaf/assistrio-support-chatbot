"use client";

import { Loader2 } from "lucide-react";

type Props = {
  message?: string;
  /** Tighter when nested inside a page (vs full main overlay). */
  variant?: "overlay" | "inline";
  /** Second line under the message. Use `false` to hide. Default: “Setting up your trial workspace”. */
  subtitle?: string | false;
};

/**
 * Centered workspace loading — dashboard shell overlay and playground gates.
 */
export function TrialWorkspaceLoadingCenter({
  message = "Loading workspace…",
  variant = "overlay",
  subtitle,
}: Props) {
  const box =
    variant === "overlay"
      ? "flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 py-12"
      : "flex min-h-[min(50vh,18rem)] flex-col items-center justify-center gap-4 px-4 py-8";

  return (
    <div className={box}>
      <div className="relative flex h-16 w-16 items-center justify-center" aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-[var(--brand-teal)]/20" />
        <span className="absolute inset-2 rounded-full border-2 border-[var(--brand-teal)]/25" />
        <Loader2 className="relative h-9 w-9 animate-spin text-[var(--brand-teal)]" strokeWidth={2} />
      </div>
      <p className="max-w-[22rem] text-center text-[15px] font-medium leading-snug text-slate-600">{message}</p>
      {subtitle !== false ? (
        <p className="text-center text-[12px] text-slate-400">{subtitle ?? "Setting up your trial workspace"}</p>
      ) : null}
    </div>
  );
}
