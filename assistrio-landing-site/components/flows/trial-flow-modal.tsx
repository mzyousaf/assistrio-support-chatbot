"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TrialForm } from "@/components/sections/trial/trial-form";
import { PvTrialResumeSection } from "@/components/visitor/pv-trial-resume-section";
import { ReconnectSavedId } from "@/components/visitor/reconnect-saved-id";
import { StableIdentityPanel } from "@/components/visitor/stable-identity-panel";
import { usePlatformVisitorId } from "@/hooks/usePlatformVisitorId";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  panelTransition,
  stepContentTransition,
  stepMotionVariants,
} from "@/lib/motion/reduced-motion";
import {
  clearPvLastTrialBotRef,
  readPvLastTrialBotRefForActivePlatformVisitor,
  type PvLastTrialBotRef,
} from "@/lib/identity/pv-last-trial-bot";

const ease = [0.22, 1, 0.36, 1] as const;
const springPanel = { type: "spring", stiffness: 380, damping: 32, mass: 0.85 } as const;
const springContent = { type: "spring", stiffness: 440, damping: 34, mass: 0.72 } as const;
const springProgress = { type: "spring", stiffness: 260, damping: 28 } as const;

const TRIAL_STEP_LABELS = ["Introduction", "Website hostname", "Workspace key", "Create your bot"] as const;
const TRIAL_STEP_SHORT = ["Intro", "Site", "Key", "Bot"] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]/35 focus-visible:ring-offset-2";

export function TrialFlowModal({ open, onClose }: Props) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialCloseRef = useRef<HTMLButtonElement>(null);
  const prevOpenRef = useRef(false);

  const [step, setStep] = useState(1);
  const [stepDir, setStepDir] = useState<1 | -1>(1);
  const [hostname, setHostname] = useState("");
  const [resumeRefreshTick, setResumeRefreshTick] = useState(0);
  const [resumeRef, setResumeRef] = useState<PvLastTrialBotRef | null>(null);
  const [trialCompleted, setTrialCompleted] = useState(false);
  const { platformVisitorId, status } = usePlatformVisitorId();

  useLayoutEffect(() => {
    if (!open) return;
    setStep(1);
    setStepDir(1);
    setHostname("");
    setTrialCompleted(false);
  }, [open]);

  useEffect(() => {
    if (status !== "ready" || !platformVisitorId) {
      setResumeRef(null);
      return;
    }
    setResumeRef(readPvLastTrialBotRefForActivePlatformVisitor(platformVisitorId));
  }, [platformVisitorId, status, resumeRefreshTick, open]);

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

  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    const openedNow = !prevOpenRef.current;
    prevOpenRef.current = true;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (openedNow) {
          initialCloseRef.current?.focus();
          return;
        }
        if (step === 2) {
          document.getElementById("trial-flow-hostname")?.focus();
          return;
        }
        document.getElementById(`trial-flow-focus-step-${step}`)?.focus();
      });
    });
    return () => cancelAnimationFrame(id);
  }, [open, step]);

  function handleForgetResume() {
    clearPvLastTrialBotRef();
    setResumeRef(null);
  }

  function goNext() {
    setStepDir(1);
    setStep((s) => s + 1);
  }

  function goBack() {
    setStepDir(-1);
    setStep((s) => Math.max(1, s - 1));
  }

  const progress = (step / 4) * 100;
  const identityReady = status === "ready" && !!platformVisitorId;
  const panelTransitionVal = panelTransition(reduceMotion, springPanel);
  const contentTransitionVal = stepContentTransition(reduceMotion, springContent);
  const progressTransitionVal = reduceMotion ? { duration: 0.25, ease } : springProgress;
  const stepVariants = stepMotionVariants(reduceMotion, stepDir);
  const tapProps = reduceMotion ? {} : { whileTap: { scale: 0.97 } };

  const nextStepLabel = step < 4 ? TRIAL_STEP_LABELS[step] : "";

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
            transition={{ duration: 0.28, ease }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            key="trial-panel"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trial-flow-title"
            aria-describedby="trial-flow-description trial-flow-step-live"
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={panelTransitionVal}
            className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-[min(100%,34rem)] flex-col overflow-hidden rounded-t-[1.35rem] border border-[var(--border-default)] bg-white shadow-[0_28px_80px_-24px_rgba(15,23,42,0.22),0_12px_36px_-16px_rgba(13,148,136,0.14)] sm:rounded-[1.5rem]"
          >
            <p id="trial-flow-description" className="sr-only">
              Multi-step Explore flow: choose your allowed website, save a workspace key, then create your evaluation bot and copy
              your embed snippet.
            </p>
            <div
              id="trial-flow-step-live"
              className="sr-only"
              aria-live="polite"
              aria-atomic="true"
            >
              Step {step} of 4: {TRIAL_STEP_LABELS[step - 1]}
            </div>

            <div className="border-b border-[var(--border-default)] bg-gradient-to-r from-[var(--brand-teal-subtle)]/50 to-white px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-eyebrow">Explore Assistrio</p>
                  <h2
                    id="trial-flow-title"
                    className="mt-1 font-[family-name:var(--font-display)] text-xl font-medium text-slate-900"
                  >
                    Try it free
                  </h2>
                </div>
                <motion.button
                  ref={initialCloseRef}
                  type="button"
                  onClick={onClose}
                  {...(reduceMotion ? {} : { whileTap: { scale: 0.94 } })}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className={`rounded-[var(--radius-md)] p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 ${focusRing}`}
                  aria-label="Close Explore dialog"
                >
                  <span aria-hidden className="text-xl leading-none">
                    ×
                  </span>
                </motion.button>
              </div>
              <div
                className="mt-4 flex items-center gap-3"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={4}
                aria-valuenow={step}
                aria-valuetext={`Step ${step} of 4: ${TRIAL_STEP_LABELS[step - 1]}`}
              >
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/90">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--brand-teal)] to-teal-400"
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={progressTransitionVal}
                    aria-hidden
                  />
                </div>
                <motion.span
                  key={step}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 500, damping: 34 }}
                  className="min-w-[2.75rem] text-right text-xs font-semibold tabular-nums text-slate-600"
                >
                  {step}/4
                </motion.span>
              </div>
              <div
                className="mt-3 flex justify-between gap-2 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400"
                aria-label="Explore steps"
              >
                {TRIAL_STEP_SHORT.map((label, i) => {
                  const active = i + 1 === step;
                  return (
                    <motion.span
                      key={label}
                      aria-current={active ? "step" : undefined}
                      title={TRIAL_STEP_LABELS[i]}
                      animate={
                        reduceMotion
                          ? { color: active ? "var(--brand-teal-dark)" : undefined }
                          : {
                              color: active ? "var(--brand-teal-dark)" : undefined,
                              scale: active ? 1.03 : 1,
                              fontWeight: active ? 600 : 500,
                            }
                      }
                      transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 28 }}
                    >
                      {label}
                    </motion.span>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-6 sm:px-7">
              {resumeRef && step === 1 ? (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.35, ease }}
                  className="mb-6"
                >
                  <PvTrialResumeSection refData={resumeRef} onForget={handleForgetResume} />
                </motion.div>
              ) : null}

              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="s1"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={contentTransitionVal}
                    className="space-y-4"
                  >
                    <p
                      id="trial-flow-focus-step-1"
                      tabIndex={-1}
                      className={`text-lg font-medium leading-snug text-slate-900 ${focusRing}`}
                    >
                      Grounded answers on your allowed website — in minutes.
                    </p>
                    <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
                      You&apos;ll choose which allowed websites may run the widget, save a workspace key for reconnect, then get an embed
                      snippet. No card required to start.
                    </p>
                    <ul className="space-y-2 text-sm text-[var(--foreground-muted)]">
                      <li className="flex gap-2">
                        <span className="text-[var(--brand-teal)]" aria-hidden>
                          ✓
                        </span>
                        <span>Runtime on allowed websites you control — not preview on this marketing site.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[var(--brand-teal)]" aria-hidden>
                          ✓
                        </span>
                        <span>Same public API model as production embeds.</span>
                      </li>
                    </ul>
                  </motion.div>
                ) : null}

                {step === 2 ? (
                  <motion.div
                    key="s2"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={contentTransitionVal}
                    className="space-y-4"
                  >
                    <p
                      id="trial-flow-focus-step-2"
                      tabIndex={-1}
                      className={`text-sm font-medium text-slate-900 ${focusRing}`}
                    >
                      Where should runtime be allowed?
                    </p>
                    <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
                      We store the <strong className="font-medium text-slate-800">hostname</strong> from your URL. Paste
                      your site or leave blank to use this page&apos;s host.
                    </p>
                    <div>
                      <label htmlFor="trial-flow-hostname" className="block text-sm font-medium text-slate-800">
                        Website or base URL
                      </label>
                      <input
                        id="trial-flow-hostname"
                        value={hostname}
                        onChange={(e) => setHostname(e.target.value)}
                        placeholder="e.g. https://www.example.com/docs"
                        className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--border-teal-soft)] focus:ring-2 focus:ring-[var(--brand-teal)]/25"
                        autoComplete="off"
                      />
                    </div>
                  </motion.div>
                ) : null}

                {step === 3 ? (
                  <motion.div
                    key="s3"
                    id="trial-flow-identity"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={contentTransitionVal}
                    className="space-y-5"
                  >
                    <p
                      id="trial-flow-focus-step-3"
                      tabIndex={-1}
                      className={`text-sm leading-relaxed text-[var(--foreground-muted)] ${focusRing}`}
                    >
                      Your <strong className="font-medium text-slate-800">workspace key</strong> ties this browser to
                      Explore activity and quota. Save it if you need to reconnect on another device.
                    </p>
                    <ReconnectSavedId variant="compact" copyTone="workspace" id="trial-flow-reconnect" />
                    <StableIdentityPanel variant="compact" copyTone="workspace" />
                  </motion.div>
                ) : null}

                {step === 4 ? (
                  <motion.div
                    key="s4"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={contentTransitionVal}
                    className="max-h-[min(70vh,560px)] overflow-y-auto overscroll-y-contain pr-1"
                  >
                    <TrialForm
                      hostnameOverride={hostname}
                      hideHostnameField
                      stepHeadingId="trial-flow-focus-step-4"
                      reconnectHintHref="#trial-flow-reconnect"
                      onTrialCreated={() => {
                        setTrialCompleted(true);
                        setResumeRefreshTick((n) => n + 1);
                      }}
                      onTrialHandoffLost={() => {
                        setTrialCompleted(false);
                      }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="space-y-3 border-t border-[var(--border-default)] bg-slate-50/80 px-5 py-4 sm:px-7">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border-teal-soft)] bg-[color-mix(in_srgb,var(--brand-teal-subtle)_45%,white)] px-3.5 py-3 shadow-[var(--shadow-xs)] ring-1 ring-[color-mix(in_srgb,var(--brand-teal)_12%,transparent)]">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand-teal-dark)]">Quick flow</p>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--foreground-muted)]">
                  You&apos;re in the shortcut modal — same steps as the full page, just compact. Need the full Explore experience
                  with every step on its own screen?
                </p>
                <Link
                  href="/trial"
                  className={`mt-2.5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand-teal-dark)] underline-offset-2 hover:underline ${focusRing} rounded-sm`}
                  onClick={onClose}
                >
                  Open full Explore page
                  <span aria-hidden>→</span>
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {step > 1 && step < 4 ? (
                  <motion.span className="inline-flex" {...tapProps}>
                    <Button type="button" variant="ghost" onClick={goBack} aria-label="Go back to previous Explore step">
                      Back
                    </Button>
                  </motion.span>
                ) : null}
                {step < 3 ? (
                  <motion.span className="inline-flex" {...tapProps}>
                    <Button
                      type="button"
                      onClick={goNext}
                      className="flow-primary-cta flow-primary-cta-pulse"
                      aria-label={nextStepLabel ? `Continue to ${nextStepLabel}` : "Continue"}
                    >
                      Continue
                    </Button>
                  </motion.span>
                ) : null}
                {step === 3 ? (
                  <motion.span className="inline-flex" {...tapProps}>
                    <Button
                      type="button"
                      onClick={() => {
                        setStepDir(1);
                        setStep(4);
                      }}
                      disabled={!identityReady}
                      className={identityReady ? "flow-primary-cta flow-primary-cta-pulse" : undefined}
                      aria-label={
                        identityReady
                          ? `Continue to ${TRIAL_STEP_LABELS[3]}`
                          : "Waiting for workspace identity to finish loading"
                      }
                    >
                      {identityReady ? "Continue" : "Preparing workspace…"}
                    </Button>
                  </motion.span>
                ) : null}
                {step === 4 && trialCompleted ? (
                  <motion.span className="inline-flex" {...tapProps}>
                    <Button type="button" variant="ghost" onClick={onClose} aria-label="Close Explore dialog">
                      Done
                    </Button>
                  </motion.span>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
