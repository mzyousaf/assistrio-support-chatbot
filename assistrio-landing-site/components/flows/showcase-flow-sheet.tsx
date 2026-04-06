"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AssistrioShowcaseRuntimeEmbed } from "@/components/widget/assistrio-showcase-runtime-embed";
import { Button } from "@/components/ui/button";
import { fetchPublicShowcaseBotsClient } from "@/lib/api/public-client";
import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";
import { usePlatformVisitorId } from "@/hooks/usePlatformVisitorId";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  panelTransition,
  stepContentTransition,
  showcaseStepMotionVariants,
} from "@/lib/motion/reduced-motion";
import type { PublicBotListItem } from "@/types/bot";

const ease = [0.22, 1, 0.36, 1] as const;
const springSheet = { type: "spring", stiffness: 340, damping: 36, mass: 0.9 } as const;
const springContent = { type: "spring", stiffness: 440, damping: 34, mass: 0.72 } as const;
const springProgress = { type: "spring", stiffness: 260, damping: 28 } as const;

const SHOWCASE_STEP_LABELS = ["Choose a demo AI Agent", "Runtime preview", "Snippets and next steps"] as const;
const SHOWCASE_STEP_SHORT = ["Pick", "Preview", "Next"] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  initialSlug: string | null;
};

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)]/35 focus-visible:ring-offset-2";

function ShowcaseBotListSkeleton() {
  return (
    <ul className="mt-5 space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-3 shadow-[var(--shadow-xs)]"
        >
          <div className="h-11 w-11 shrink-0 rounded-xl assistrio-skeleton" />
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <div className="h-4 w-[60%] max-w-[12rem] rounded assistrio-skeleton" />
            <div className="h-3 w-full rounded assistrio-skeleton opacity-80" />
            <div className="h-3 w-[80%] rounded assistrio-skeleton opacity-70" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ShowcaseFlowSheet({ open, onClose, initialSlug }: Props) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLElement>(null);
  const initialCloseRef = useRef<HTMLButtonElement>(null);
  const prevOpenRef = useRef(false);

  const [step, setStep] = useState(1);
  const [stepDir, setStepDir] = useState<1 | -1>(1);
  const [bots, setBots] = useState<PublicBotListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PublicBotListItem | null>(null);
  const { platformVisitorId, status } = usePlatformVisitorId();
  const identityReady = status === "ready" && !!platformVisitorId;

  useLayoutEffect(() => {
    if (!open) return;
    setStep(1);
    setStepDir(1);
    setSelected(null);
    setLoadError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const base = tryGetPublicApiBaseUrl();
    if (!base) {
      setBots([]);
      setLoadError("Marketing site is missing NEXT_PUBLIC_ASSISTRIO_API_BASE_URL.");
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPublicShowcaseBotsClient()
      .then((list) => {
        setBots(list);
        if (initialSlug) {
          const found = list.find((b) => b.slug === initialSlug);
          if (found) {
            setSelected(found);
            setStep(2);
          }
        }
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : "Could not load demos");
      })
      .finally(() => setLoading(false));
  }, [open, initialSlug]);

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
        document.getElementById(`showcase-focus-step-${step}`)?.focus();
      });
    });
    return () => cancelAnimationFrame(id);
  }, [open, step]);

  const progress = (step / 3) * 100;
  const panelTransitionVal = panelTransition(reduceMotion, springSheet);
  const contentTransitionVal = stepContentTransition(reduceMotion, springContent);
  const progressTransitionVal = reduceMotion ? { duration: 0.25, ease } : springProgress;
  const stepVariants = showcaseStepMotionVariants(reduceMotion, stepDir);
  const tapProps = reduceMotion ? {} : { whileTap: { scale: 0.97 } };

  function goBack() {
    setStepDir(-1);
    setStep((s) => Math.max(1, s - 1));
  }

  function pickBot(b: PublicBotListItem) {
    setStepDir(1);
    setSelected(b);
    setStep(2);
  }

  function goToSnippets() {
    setStepDir(1);
    setStep(3);
  }

  const nextLabel = step === 2 ? SHOWCASE_STEP_LABELS[2] : "";

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div
            key="showcase-backdrop"
            role="presentation"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease }}
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.aside
            key="showcase-panel"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="showcase-flow-title"
            aria-describedby="showcase-flow-description showcase-flow-step-live"
            initial={{ x: "104%", opacity: 0.92 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "104%", opacity: 0.9 }}
            transition={panelTransitionVal}
            className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--border-default)] bg-white shadow-[0_24px_70px_-20px_rgba(15,23,42,0.2),0_10px_32px_-14px_rgba(13,148,136,0.12)] sm:max-h-[100dvh]"
          >
            <p id="showcase-flow-description" className="sr-only">
              Browse curated demo AI Agents, try runtime chat on this site, then open the full demo page for snippets and setup.
            </p>
            <div id="showcase-flow-step-live" className="sr-only" aria-live="polite" aria-atomic="true">
              Step {step} of 3: {SHOWCASE_STEP_LABELS[step - 1]}
            </div>

            <div className="border-b border-[var(--border-default)] bg-gradient-to-br from-[var(--brand-teal-subtle)]/35 to-white px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-eyebrow">Showcase</p>
                  <h2
                    id="showcase-flow-title"
                    className="mt-1 font-[family-name:var(--font-display)] text-xl font-medium text-slate-900"
                  >
                    Live demos
                  </h2>
                </div>
                <motion.button
                  ref={initialCloseRef}
                  type="button"
                  onClick={onClose}
                  {...(reduceMotion ? {} : { whileTap: { scale: 0.94 } })}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className={`rounded-[var(--radius-md)] p-2 text-slate-500 transition-colors hover:bg-slate-100 ${focusRing}`}
                  aria-label="Close live demos panel"
                >
                  <span className="text-xl leading-none" aria-hidden>
                    ×
                  </span>
                </motion.button>
              </div>
              <div
                className="mt-4 flex items-center gap-3"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={step}
                aria-valuetext={`Step ${step} of 3: ${SHOWCASE_STEP_LABELS[step - 1]}`}
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
                  initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 500, damping: 34 }}
                  className="min-w-[2.75rem] text-right text-xs font-semibold tabular-nums text-slate-600"
                >
                  {step}/3
                </motion.span>
              </div>
              <div className="mt-3 flex justify-between gap-2 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400" aria-label="Showcase steps">
                {SHOWCASE_STEP_SHORT.map((label, i) => {
                  const active = i + 1 === step;
                  return (
                    <motion.span
                      key={label}
                      aria-current={active ? "step" : undefined}
                      title={SHOWCASE_STEP_LABELS[i]}
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

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-5">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="sh1"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={contentTransitionVal}
                  >
                    <p
                      id="showcase-focus-step-1"
                      tabIndex={-1}
                      className={`text-sm leading-relaxed text-[var(--foreground-muted)] ${focusRing}`}
                    >
                      Pick a curated AI Agent — you&apos;ll chat with real runtime on this site (showcase quota). Owner preview
                      stays in the Assistrio app.
                    </p>
                    {loading ? (
                      <div className="mt-6" role="status" aria-live="polite" aria-busy="true">
                        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">
                          {!reduceMotion ? (
                            <span className="relative flex h-2 w-2" aria-hidden>
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-teal)] opacity-40" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand-teal)]" />
                            </span>
                          ) : null}
                          Loading demo list
                        </div>
                        <ShowcaseBotListSkeleton />
                      </div>
                    ) : loadError ? (
                      <p
                        className="mt-4 rounded-[var(--radius-lg)] border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950"
                        role="alert"
                      >
                        {loadError}
                      </p>
                    ) : bots.length === 0 ? (
                      <p className="mt-4 text-sm text-[var(--foreground-muted)]">No showcase AI Agents available.</p>
                    ) : (
                      <ul className="mt-5 space-y-3" aria-label="Showcase demo AI Agents">
                        {bots.map((b) => (
                          <li key={b.id}>
                            <motion.button
                              type="button"
                              aria-label={`Open preview for ${b.name}`}
                              onClick={() => pickBot(b)}
                              {...(reduceMotion ? {} : { whileHover: { scale: 1.01 }, whileTap: { scale: 0.99 } })}
                              transition={{ type: "spring", stiffness: 480, damping: 32 }}
                              className={`flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-3 text-left shadow-[var(--shadow-xs)] transition-shadow hover:border-[var(--border-teal-soft)] hover:shadow-[var(--shadow-md)] ${focusRing}`}
                            >
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/80 text-xl" aria-hidden>
                                {b.avatarEmoji ?? "💬"}
                              </span>
                              <span className="min-w-0">
                                <span className="block font-semibold text-slate-900">{b.name}</span>
                                {b.shortDescription ? (
                                  <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--foreground-muted)]">
                                    {b.shortDescription}
                                  </span>
                                ) : null}
                              </span>
                            </motion.button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-6 text-center">
                      <Link href="/gallery" className={`link-inline text-sm font-medium ${focusRing} rounded-sm`} onClick={onClose}>
                        View full gallery page
                      </Link>
                    </p>
                  </motion.div>
                ) : null}

                {step === 2 && selected ? (
                  <motion.div
                    key="sh2"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={contentTransitionVal}
                    className="space-y-4"
                  >
                    <div
                      id="showcase-focus-step-2"
                      tabIndex={-1}
                      className={`flex items-center gap-2 ${focusRing} rounded-sm`}
                    >
                      <motion.span
                        className="text-2xl"
                        aria-hidden
                        initial={reduceMotion ? false : { scale: 0.85, rotate: -8 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 22 }}
                      >
                        {selected.avatarEmoji ?? "💬"}
                      </motion.span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">Preview</p>
                        <p className="font-[family-name:var(--font-display)] text-lg font-medium text-slate-900">
                          {selected.name}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
                      Messages use showcase runtime quota for this browser&apos;s workspace session — same API path as
                      production.
                    </p>
                    {selected.id && selected.accessKey ? (
                      <AssistrioShowcaseRuntimeEmbed
                        botId={selected.id}
                        accessKey={selected.accessKey}
                        platformVisitorId={platformVisitorId}
                        identityReady={identityReady}
                      />
                    ) : (
                      <p className="text-sm text-amber-900">This AI Agent is missing runtime credentials in the public list.</p>
                    )}
                  </motion.div>
                ) : null}

                {step === 3 && selected ? (
                  <motion.div
                    key="sh3"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={contentTransitionVal}
                    className="space-y-4"
                  >
                    <p
                      id="showcase-focus-step-3"
                      tabIndex={-1}
                      className={`text-sm font-medium text-slate-900 ${focusRing}`}
                    >
                      Snippets & your allowed website
                    </p>
                    <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">
                      Copy access keys, register your site, and get the full embed story on the demo page — no need to hunt
                      through the marketing site.
                    </p>
                    <motion.div {...(reduceMotion ? {} : { whileHover: { scale: 1.01 }, whileTap: { scale: 0.99 } })}>
                      <Link
                        href={`/bots/${encodeURIComponent(selected.slug)}`}
                        className={`flow-primary-cta flow-primary-cta-pulse inline-flex w-full items-center justify-center rounded-[var(--radius-md)] px-5 py-3 text-sm font-semibold bg-[var(--brand-teal)] text-white ${focusRing}`}
                        onClick={onClose}
                        aria-label={`Open full demo page for ${selected.name}`}
                      >
                        Open full demo page
                      </Link>
                    </motion.div>
                    <p className="text-center text-xs text-[var(--foreground-muted)]">
                      You can return here anytime from <strong className="font-medium text-slate-700">Browse demos</strong>.
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-default)] bg-slate-50/80 px-5 py-4">
              {step > 1 ? (
                <motion.span className="inline-flex" {...tapProps}>
                  <Button type="button" variant="ghost" onClick={goBack} aria-label="Go back to previous showcase step">
                    Back
                  </Button>
                </motion.span>
              ) : (
                <span aria-hidden className="inline-block min-w-[1px]" />
              )}
              <div className="flex gap-2">
                {step === 2 ? (
                  <motion.span className="inline-flex" {...tapProps}>
                    <Button
                      type="button"
                      onClick={goToSnippets}
                      className="flow-primary-cta flow-primary-cta-pulse"
                      aria-label={nextLabel ? `Continue to ${nextLabel}` : "Continue"}
                    >
                      Snippets &amp; next steps
                    </Button>
                  </motion.span>
                ) : null}
                {step === 3 ? (
                  <motion.span className="inline-flex" {...tapProps}>
                    <Button type="button" variant="ghost" onClick={onClose} aria-label="Close live demos panel">
                      Done
                    </Button>
                  </motion.span>
                ) : null}
              </div>
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
