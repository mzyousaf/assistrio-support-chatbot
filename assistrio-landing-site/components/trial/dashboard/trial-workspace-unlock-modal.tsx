"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Bot, ClipboardList, Construction, X } from "lucide-react";
import {
  landingModalBackdropClass,
  landingModalCloseButtonClass,
  landingModalFooterBarClass,
  landingModalHeaderIconWrapClass,
  landingModalPanelSurfaceClass,
} from "@/lib/landing-modal-styles";

export type TrialWorkspaceUnlockVariant = "onboarding" | "agent" | "feature";

type Props = {
  open: boolean;
  variant: TrialWorkspaceUnlockVariant;
  onClose: () => void;
  /** First incomplete or current setup step */
  setupContinueHref: string;
  /** e.g. close mobile drawer after navigation */
  onAfterNavigate?: () => void;
};

const ease = [0.22, 1, 0.36, 1] as const;
const soft = { duration: 0.22, ease };

function variantIcon(v: TrialWorkspaceUnlockVariant) {
  const cls = "h-5 w-5";
  if (v === "onboarding") return <ClipboardList className={cls} strokeWidth={1.75} aria-hidden />;
  if (v === "feature") return <Construction className={cls} strokeWidth={1.75} aria-hidden />;
  return <Bot className={cls} strokeWidth={1.75} aria-hidden />;
}

function variantEyebrow(v: TrialWorkspaceUnlockVariant): string {
  if (v === "onboarding") return "Setup";
  if (v === "feature") return "Trial";
  return "Next step";
}

export function TrialWorkspaceUnlockModal({
  open,
  variant,
  onClose,
  setupContinueHref,
  onAfterNavigate,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isOnboarding = variant === "onboarding";
  const isFeature = variant === "feature";

  function primary() {
    if (isOnboarding) {
      router.push(setupContinueHref);
    } else if (isFeature) {
      router.push("/trial/dashboard/playground/profile");
    } else {
      router.push("/trial/dashboard/setup/creating");
    }
    onClose();
    onAfterNavigate?.();
  }

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <motion.div
          key="trial-workspace-unlock"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          aria-modal="true"
          role="dialog"
          aria-labelledby="trial-unlock-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={soft}
        >
          <button
            type="button"
            aria-label="Close dialog"
            className={`absolute inset-0 ${landingModalBackdropClass}`}
            onClick={onClose}
          />
          <motion.div
            className={`relative w-full max-w-[24rem] ${landingModalPanelSurfaceClass}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={soft}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className={`absolute right-2.5 top-2.5 z-[1] ${landingModalCloseButtonClass}`}
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </button>

            <div className="border-b border-slate-100/90 bg-gradient-to-br from-[var(--brand-teal-subtle)]/45 via-white to-white px-6 pb-6 pt-9 text-center sm:px-7 sm:pb-7 sm:pt-10">
              <div className="mx-auto flex max-w-[19rem] flex-col items-center">
                <div className={landingModalHeaderIconWrapClass}>{variantIcon(variant)}</div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal-dark)]/85">
                  {variantEyebrow(variant)}
                </p>
                <h2
                  id="trial-unlock-title"
                  className="mt-2 font-[family-name:var(--font-display)] text-[1.125rem] font-semibold leading-tight tracking-tight text-slate-900 sm:text-xl sm:leading-snug"
                >
                  {isOnboarding ? "Complete setup first" : isFeature ? "Not available in trial yet" : "Create your AI Agent"}
                </h2>
                <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                  {isOnboarding
                    ? "Finish the remaining steps to unlock your workspace, insights, and publishing tools."
                    : isFeature
                      ? "This area is still being connected for the public trial. Profile and Behavior are ready to use."
                      : "You are ready to generate your trial agent — that unlocks Profile and Behavior in Playground."}
                </p>
              </div>
            </div>

            <div className={`${landingModalFooterBarClass} flex flex-col gap-2 sm:flex-row sm:justify-stretch`}>
              <button
                type="button"
                onClick={primary}
                className="inline-flex w-full flex-1 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--brand-teal)] px-4 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-teal-700/10 transition hover:bg-[var(--brand-teal-hover)] active:scale-[0.99] sm:min-h-[2.75rem]"
              >
                {isOnboarding ? "Continue setup" : isFeature ? "Open Profile" : "Go to agent creation"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-full flex-1 items-center justify-center rounded-[var(--radius-lg)] border border-slate-200/90 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] sm:min-h-[2.75rem] sm:max-w-[9rem] sm:flex-none"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
