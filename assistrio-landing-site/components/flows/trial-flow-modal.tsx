"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock, Inbox, Mail, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrialExploreFlowModalLegacy } from "@/components/flows/trial-explore-flow-modal-legacy";
import { TrialTextInput } from "@/components/trial/dashboard/trial-forms/trial-text-input";
import { usePlatformVisitorId } from "@/hooks/usePlatformVisitorId";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { landingModalCloseButtonClass, landingModalFooterBarClass, landingModalHeaderIconWrapClass } from "@/lib/landing-modal-styles";
import type { TrialCtaOpenContext, TrialLeadCaptureSuccessPayload } from "@/lib/flows/trial-cta-types";
import { requestTrialAccess } from "@/lib/trial/request-trial-access";

/** Set `true` only for emergency rollback to the old 4-step Explore modal. */
const USE_LEGACY_TRIAL_EXPLORE_MODAL = false;

const MAX = { name: 120, email: 254 } as const;
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]/35 focus-visible:ring-offset-2";

type FieldErrors = Partial<Record<"name" | "email", string>>;

type Props = {
  open: boolean;
  onClose: () => void;
  /** CTA context from `CtaFlowProvider` — analytics + Prompt 2 lead API. */
  ctaContext: TrialCtaOpenContext | null;
  /** Optional hook for Prompt 2+ (e.g. navigate to check-email step). */
  onLeadCaptureSuccess?: (payload: TrialLeadCaptureSuccessPayload) => void;
};

const ease = [0.22, 1, 0.36, 1] as const;
const backdropTransition = { duration: 0.22, ease } as const;
const panelMotion = (reduceMotion: boolean | null) =>
  reduceMotion ? { duration: 0.2, ease } : { duration: 0.26, ease };

export function TrialFlowModal({ open, onClose, ctaContext, onLeadCaptureSuccess }: Props) {
  if (USE_LEGACY_TRIAL_EXPLORE_MODAL) {
    return <TrialExploreFlowModalLegacy open={open} onClose={onClose} />;
  }
  return (
    <TrialLeadStepModal
      open={open}
      onClose={onClose}
      ctaContext={ctaContext}
      onLeadCaptureSuccess={onLeadCaptureSuccess}
    />
  );
}

function TrialLeadStepModal({ open, onClose, ctaContext, onLeadCaptureSuccess }: Props) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const { track } = useTrackEvent();
  const { platformVisitorId, status: pvStatus } = usePlatformVisitorId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const identityReady = pvStatus === "ready" && !!platformVisitorId;
  const panelTransitionVal = panelMotion(reduceMotion);

  const cta = ctaContext;

  useLayoutEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setFieldErrors({});
    setFormError(null);
    setSubmitting(false);
    setSuccess(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open || success) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    });
    return () => cancelAnimationFrame(id);
  }, [open, success]);

  function ctaTrackMeta() {
    if (!cta) return {};
    return {
      location: cta.location,
      label: cta.label,
      href: cta.href,
      sourcePath: cta.sourcePath,
      showcaseSlug: cta.showcaseSlug ?? undefined,
      showcaseBotId: cta.showcaseBotId ?? undefined,
    };
  }

  function goBackToEditEmail() {
    setSuccess(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        emailInputRef.current?.focus();
      });
    });
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    const n = name.trim();
    const em = email.trim();
    if (!n) next.name = "Enter your name.";
    else if (n.length > MAX.name) next.name = `Name must be at most ${MAX.name} characters.`;
    if (!em) next.email = "Enter your email address.";
    else if (em.length > MAX.email) next.email = `Email must be at most ${MAX.email} characters.`;
    else if (!emailOk(em)) next.email = "Enter a valid email address.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    if (!cta) {
      setFormError("Something went wrong. Please close and try again.");
      return;
    }
    if (!identityReady) {
      setFormError("Waiting for your browser session. Try again in a moment.");
      return;
    }

    setSubmitting(true);
    track("trial_lead_step1_submit_started", ctaTrackMeta());

    const payload: TrialLeadCaptureSuccessPayload = {
      name: name.trim(),
      email: email.trim(),
      platformVisitorId,
      platformVisitorReady: identityReady,
      cta,
    };

    try {
      await requestTrialAccess({
        name: payload.name,
        email: payload.email,
        platformVisitorId: platformVisitorId!,
        cta,
      });
      setSuccess(true);
      track("trial_lead_step1_submit_succeeded", ctaTrackMeta());
      onLeadCaptureSuccess?.(payload);
    } catch (err) {
      const e = err as Error & { errorCode?: string; status?: number; retryAfterSeconds?: number };
      const msg =
        typeof e.message === "string" && e.message.trim()
          ? e.message.trim()
          : "Something went wrong. Please try again.";
      setFormError(msg);
      if (process.env.NODE_ENV === "development") {
        console.error("[Assistrio lead form] submit failed:", err);
      }
      track("trial_lead_step1_submit_failed", ctaTrackMeta());
    } finally {
      setSubmitting(false);
    }
  }

  const titleId = "trial-lead-modal-title";
  const descId = "trial-lead-modal-desc";

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6">
          <motion.div
            key="trial-backdrop"
            role="presentation"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="trial-panel"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={panelTransitionVal}
            className="relative z-10 flex max-h-[min(92vh,640px)] w-full max-w-[min(100%,26rem)] flex-col overflow-hidden rounded-t-[1.25rem] border border-[var(--border-default)] bg-white shadow-[0_24px_64px_-28px_rgba(15,23,42,0.2)] sm:rounded-2xl"
          >
            <div
              className={`shrink-0 border-b border-[var(--border-default)] px-5 py-5 sm:px-6 ${
                success
                  ? "bg-gradient-to-br from-emerald-50/90 via-[var(--brand-teal-subtle)]/35 to-white"
                  : "bg-gradient-to-br from-[var(--brand-teal-subtle)]/55 via-[var(--brand-teal-subtle)]/25 to-white"
              }`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div
                  className={`${landingModalHeaderIconWrapClass} mt-0.5 shrink-0 ${
                    success ? "from-emerald-100/90 to-white text-emerald-800 ring-emerald-200/60" : ""
                  }`}
                  aria-hidden
                >
                  {success ? (
                    <Mail className="h-5 w-5" strokeWidth={1.75} />
                  ) : (
                    <Sparkles className="h-5 w-5" strokeWidth={1.75} />
                  )}
                </div>
                <div className="min-w-0 flex-1 pr-1">
                  <p className="text-eyebrow">{success ? "You're in" : "Assistrio"}</p>
                  <h2
                    id={titleId}
                    className="mt-1 font-[family-name:var(--font-display)] text-[1.125rem] font-semibold leading-tight tracking-tight text-slate-900 sm:text-xl sm:leading-snug"
                  >
                    {success ? "Check your email" : "Create your AI agent"}
                  </h2>
                  <p id={descId} className="mt-2 text-[13px] leading-relaxed text-slate-600">
                    {success ? (
                      <>
                        We sent a secure link of your AI Agent to{" "}
                        <span className="break-all font-medium text-slate-800">{email.trim()}</span>
                      </>
                    ) : (
                      "Add your details and we will email a secure link to continue setup."
                    )}
                  </p>
                </div>
                <button type="button" onClick={onClose} className={`shrink-0 ${landingModalCloseButtonClass}`} aria-label="Close dialog">
                  <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </button>
              </div>
            </div>

            {success ? (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-6 sm:px-7">
                <div className="mx-auto max-w-[20rem] space-y-5" role="region" aria-live="polite">
                  <ul className="space-y-3 text-[13px] leading-snug text-slate-600">
                    <li className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-teal-subtle)]/80 text-[var(--brand-teal-dark)] ring-1 ring-[var(--border-teal-soft)]/60">
                        <Clock className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      <span className="min-w-0 pt-0.5">
                        <span className="font-medium text-slate-800">Usually arrives within a minute.</span>
                        <span className="mt-0.5 block text-[12px] text-slate-500">Your trial spot is saved while you wait.</span>
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/80">
                        <Inbox className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </span>
                      <span className="min-w-0 pt-0.5">
                        <span className="font-medium text-slate-800">Not in your inbox?</span>
                        <span className="mt-0.5 block text-[12px] text-slate-500">Check Spam or Promotions — new senders are often filtered.</span>
                      </span>
                    </li>
                  </ul>

                  <button
                    type="button"
                    onClick={goBackToEditEmail}
                    className={`w-full rounded-[var(--radius-md)] border border-slate-200/95 bg-white px-3 py-2.5 text-center text-sm font-semibold text-[var(--brand-teal-dark)] shadow-sm transition-colors hover:border-[var(--border-teal-soft)] hover:bg-[var(--brand-teal-subtle)]/40 ${focusRing}`}
                  >
                    Use a different email
                  </button>
                </div>
              </div>
            ) : (
              <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={onSubmit} noValidate>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-5 py-6 sm:px-7">
                  {!identityReady ? (
                    <p
                      className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-xs leading-relaxed text-amber-950"
                      role="status"
                    >
                      Preparing your browser session…
                    </p>
                  ) : null}

                  <TrialTextInput
                    ref={nameInputRef}
                    id="trial-lead-name"
                    name="name"
                    autoComplete="name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }));
                    }}
                    maxLength={MAX.name}
                    error={fieldErrors.name}
                    label={
                      <>
                        Name <span className="text-red-600">*</span>
                      </>
                    }
                  />

                  <TrialTextInput
                    ref={emailInputRef}
                    id="trial-lead-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
                    }}
                    maxLength={MAX.email}
                    error={fieldErrors.email}
                    label={
                      <>
                        Email <span className="text-red-600">*</span>
                      </>
                    }
                  />

                  {formError ? (
                    <p className="rounded-lg border border-red-200 bg-red-50/90 px-3 py-2.5 text-sm text-red-900" role="alert">
                      {formError}
                    </p>
                  ) : null}
                </div>
                <div className={landingModalFooterBarClass}>
                  <Button type="submit" variant="primary" disabled={submitting || !identityReady} className="h-11 w-full rounded-[var(--radius-md)] text-[15px] font-semibold">
                    {submitting ? "Creating…" : identityReady ? "Create your AI agent" : "Preparing…"}
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
