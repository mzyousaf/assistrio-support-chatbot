"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Info } from "lucide-react";
import {
  getSetupStepIssueMessage,
  getTrialSetupRailSegment,
  getTrialSetupStepConfig,
  getTrialSetupStepIndex,
  isSetupStepComplete,
  maxUnlockedSetupStepIndex,
  TRIAL_SETUP_STEPS,
  type TrialSetupStepId,
  type TrialWorkspaceDraftV3,
} from "@/lib/trial/trial-workspace-draft";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";

function cx(...c: Array<string | false | undefined>): string {
  return c.filter(Boolean).join(" ");
}

type Props = {
  activeStepId: TrialSetupStepId;
};

const TOOLTIP_MAX_W = 280;
const TOOLTIP_GAP = 8;

function usePrefersTouchTooltip() {
  const [touchLike, setTouchLike] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const sync = () => setTouchLike(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return touchLike;
}

function computeTooltipPosition(btn: DOMRect): { left: number; top: number } {
  const vw = window.innerWidth;
  const margin = 12;
  let left = btn.right + TOOLTIP_GAP;
  if (left + TOOLTIP_MAX_W > vw - margin) {
    left = btn.left - TOOLTIP_GAP - TOOLTIP_MAX_W;
  }
  if (left < margin) {
    left = margin;
  }
  const top = btn.top + btn.height / 2;
  return { left, top };
}

/** Matches onboarding rail title colors when used next to a step label. */
export type StepInfoTone = "default" | "emerald" | "red" | "teal" | "muted" | "neutral";

const STEP_INFO_TONE_CLASS: Record<StepInfoTone, string> = {
  default:
    "text-slate-400 hover:bg-slate-100/90 hover:text-[var(--brand-teal)] focus-visible:ring-[var(--brand-teal)]/25",
  emerald:
    "text-emerald-600 hover:bg-emerald-50/90 hover:text-emerald-700 focus-visible:ring-emerald-400/25",
  red: "text-red-600 hover:bg-red-50/90 hover:text-red-700 focus-visible:ring-red-400/30",
  teal:
    "text-[var(--brand-teal)] hover:bg-[var(--brand-teal-faint)]/90 hover:text-[var(--brand-teal-dark)] focus-visible:ring-[var(--brand-teal)]/30",
  muted: "text-slate-400 hover:bg-slate-100/80 hover:text-slate-500 focus-visible:ring-slate-400/20",
  neutral: "text-slate-600 hover:bg-slate-100/90 hover:text-slate-800 focus-visible:ring-slate-400/25",
};

const STEP_INFO_OPEN_CLASS: Record<StepInfoTone, string> = {
  default: "bg-slate-100/80 text-[var(--brand-teal)]",
  emerald: "bg-emerald-50/90 text-emerald-700",
  red: "bg-red-50/90 text-red-700",
  teal: "bg-[var(--brand-teal-faint)]/80 text-[var(--brand-teal-dark)]",
  muted: "bg-slate-100/80 text-slate-500",
  neutral: "bg-slate-100/80 text-slate-800",
};

/** Reused in setup forms (e.g. quick links) for consistent info affordance. */
export function StepInfoButton({
  body,
  label,
  tone = "default",
  variant = "info",
}: {
  body: string;
  label: string;
  /** Rail: align icon color with step state. Forms: omit (default). */
  tone?: StepInfoTone;
  /** `alert` uses a warning triangle instead of the info glyph (e.g. regression row). */
  variant?: "info" | "alert";
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnId = useId();
  const tooltipId = useId();
  const touchLike = usePrefersTouchTooltip();

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    setPos(computeTooltipPosition(el.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open || !touchLike) return;
    function onDocMouseDown(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open, touchLike]);

  useEffect(() => {
    if (!open) return;
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, [clearCloseTimer]);

  const show = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const tooltip = open ? (
    <div
      id={tooltipId}
      role="tooltip"
      className="fixed z-[10050] w-[min(17rem,calc(100vw-24px))] max-w-[280px] rounded-lg bg-white px-3 py-2.5 text-left text-[11px] leading-relaxed text-slate-600 shadow-[0_16px_50px_-12px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/[0.1]"
      style={{
        left: pos.left,
        top: pos.top,
        transform: "translateY(-50%)",
      }}
      onMouseEnter={() => {
        if (!touchLike) clearCloseTimer();
      }}
      onMouseLeave={() => {
        if (!touchLike) scheduleClose();
      }}
    >
      {body}
    </div>
  ) : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        id={btnId}
        aria-label={variant === "alert" ? `Issue details for ${label}` : `About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (touchLike) {
            setOpen((v) => !v);
          }
        }}
        onMouseEnter={() => {
          if (!touchLike) show();
        }}
        onMouseLeave={() => {
          if (!touchLike) scheduleClose();
        }}
        onFocus={() => {
          if (!touchLike) show();
        }}
        onBlur={(e) => {
          if (!touchLike && !e.currentTarget.contains(e.relatedTarget as Node)) {
            scheduleClose();
          }
        }}
        className={cx(
          "flex h-6 w-6 items-center justify-center rounded-md outline-none transition-colors",
          "focus-visible:ring-2",
          STEP_INFO_TONE_CLASS[tone],
          open && STEP_INFO_OPEN_CLASS[tone],
        )}
      >
        {variant === "alert" ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 stroke-[2.25]" strokeLinecap="round" strokeLinejoin="round" aria-hidden />
        ) : (
          <Info className="h-3.5 w-3.5 shrink-0 stroke-[2.25]" strokeLinecap="round" strokeLinejoin="round" aria-hidden />
        )}
      </button>
      {typeof document !== "undefined" && tooltip ? createPortal(tooltip, document.body) : null}
    </div>
  );
}

export function TrialOnboardingStepper({ activeStepId }: Props) {
  const { draft, hydrated } = useTrialWorkspaceDraft();
  const activeIndex = getTrialSetupStepIndex(activeStepId);
  const maxUnlocked = hydrated ? maxUnlockedSetupStepIndex(draft) : activeIndex;
  const total = TRIAL_SETUP_STEPS.length;

  return (
    <div className="min-h-0">
      <nav aria-label="Onboarding steps">
        <ol className="m-0 list-none p-0">
          {TRIAL_SETUP_STEPS.map((step, index) => (
            <SetupTimelineRow
              key={step.id}
              stepId={step.id}
              index={index}
              activeIndex={activeIndex}
              draft={draft}
              hydrated={hydrated}
              maxUnlocked={maxUnlocked}
              isLast={index === total - 1}
            />
          ))}
        </ol>
      </nav>
    </div>
  );
}

function SetupTimelineRow({
  stepId,
  index,
  activeIndex,
  draft,
  hydrated,
  maxUnlocked,
  isLast,
}: {
  stepId: TrialSetupStepId;
  index: number;
  activeIndex: number;
  draft: TrialWorkspaceDraftV3;
  hydrated: boolean;
  maxUnlocked: number;
  isLast: boolean;
}) {
  const cfg = getTrialSetupStepConfig(stepId);
  const locked = index > maxUnlocked;
  const viewing = index === activeIndex;
  const complete = isSetupStepComplete(index, draft);
  const rail = getTrialSetupRailSegment(index, draft, { hydrated });
  const showRedRegression = rail === "error";
  const showTealNext = rail === "teal";
  /** Unlocked + muted segment (quiet middle steps); locked rows also use muted styling via `locked`. */
  const isQuietUnlocked = hydrated && !locked && !complete && rail === "muted";

  const infoTone: StepInfoTone = complete
    ? "emerald"
    : showRedRegression
      ? "red"
      : showTealNext
        ? "teal"
        : locked || isQuietUnlocked
          ? "muted"
          : "neutral";

  const nodeClass = cx(
    "relative z-[1] flex shrink-0 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums transition-all duration-200",
    "h-6 w-6",
    complete && "border-emerald-400 bg-emerald-400 text-white shadow-sm",
    showRedRegression &&
      "border-red-500 bg-red-50 text-red-700 shadow-sm ring-2 ring-red-200/90 assistrio-onboarding-node-pulse-error",
    showTealNext &&
      "border-[var(--brand-teal)] bg-[var(--brand-teal)] text-white shadow-[0_2px_8px_-2px_rgba(13,148,136,0.45)] ring-2 ring-[var(--brand-teal)]/25 assistrio-onboarding-node-pulse",
    !complete &&
      !showRedRegression &&
      !showTealNext &&
      (locked || isQuietUnlocked) &&
      "border-slate-200 bg-slate-50 text-slate-400",
    !complete &&
      !showRedRegression &&
      !showTealNext &&
      !locked &&
      !isQuietUnlocked &&
      "border-slate-300/90 bg-white text-slate-600",
  );

  const connectorClass = !isLast
    ? cx(
        "w-[2px] max-w-[2px] flex-1 shrink-0  min-h-[clamp(1.125rem,3.25vh,2.25rem)] rounded-full transition-colors duration-300",
        complete && "bg-emerald-300/85",
        !complete && showRedRegression && "bg-red-300/85",
        !complete && showTealNext && "bg-[var(--brand-teal)]/35",
        !complete && !showRedRegression && !showTealNext && "bg-slate-300/60",
      )
    : "";

  const titleClass = (isMuted: boolean) =>
    cx(
      "block tracking-tight transition-colors text-[12px]",
      isMuted && "font-medium text-slate-400",
      !isMuted && complete && "font-semibold text-emerald-700",
      !isMuted && showRedRegression && "text-[0.9375rem] font-semibold text-red-800",
      !isMuted && showTealNext && "text-[0.9375rem] font-bold text-[var(--brand-teal)]",
      !isMuted &&
        !showRedRegression &&
        !showTealNext &&
        !complete &&
        (locked || isQuietUnlocked) &&
        "font-medium text-slate-400",
      !isMuted &&
        !showRedRegression &&
        !showTealNext &&
        !complete &&
        !locked &&
        !isQuietUnlocked &&
        "font-medium text-slate-600 group-hover:text-slate-800",
      !isMuted && viewing && complete && "text-[0.9375rem]",
    );

  const subClass = (isMuted: boolean) =>
    cx(
      "mt-0.5 block text-[10px] leading-snug transition-colors",
      isMuted && "text-slate-400",
      !isMuted && complete && "text-emerald-600/90",
      !isMuted && showRedRegression && "font-medium text-red-800",
      !isMuted && showTealNext && "font-medium text-[var(--brand-teal)]/85",
      !isMuted &&
        !showRedRegression &&
        !showTealNext &&
        !complete &&
        (locked || isQuietUnlocked) &&
        "text-slate-400",
      !isMuted &&
        !showRedRegression &&
        !showTealNext &&
        !complete &&
        !locked &&
        !isQuietUnlocked &&
        "text-slate-500 group-hover:text-slate-600",
    );

  const mainRow = (
    <div className={cx("flex min-w-0 gap-2", locked || !hydrated ? "items-start" : "items-center")}>
      {locked || !hydrated ? (
        <div className="flex min-w-0 flex-1 items-start gap-2 py-0.5">
          <div className="min-w-0 flex-1">
            <span className={titleClass(true)}>{cfg.label}</span>
            <span className={subClass(true)}>{cfg.navSubtitle}</span>
          </div>
          {hydrated ? <StepInfoButton body={cfg.infoBody} label={cfg.label} tone={infoTone} /> : null}
        </div>
      ) : (
        <>
          <Link
            href={cfg.path}
            className={cx(
              "min-w-0 flex-1 py-0.5 outline-none transition-colors focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-offset-1",
              isQuietUnlocked ? "" : "group",
              showRedRegression ? "focus-visible:ring-red-400/40" : "focus-visible:ring-[var(--brand-teal)]/25",
            )}
            aria-current={viewing ? "step" : undefined}
          >
            <span className={titleClass(isQuietUnlocked)}>{cfg.label}</span>
            <span className={subClass(isQuietUnlocked)}>{cfg.navSubtitle}</span>
          </Link>
          <StepInfoButton
            body={cfg.infoBody}
            label={cfg.label}
            tone={infoTone}
            variant={showRedRegression ? "alert" : "info"}
          />
        </>
      )}
    </div>
  );

  const expanded = (
    <AnimatePresence initial={false}>
      {viewing && hydrated ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="mt-2 space-y-1.5">
            <p
              className={cx(
                "text-[11px] leading-relaxed",
                showRedRegression ? "text-red-800" : "text-slate-600",
              )}
            >
              {cfg.expandedGuidance}
            </p>
            {showRedRegression ? (
              <p
                className="flex items-center gap-1.5 text-[10px] font-medium leading-snug text-red-700"
                role="alert"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" strokeWidth={2.25} aria-hidden />
                <span>{getSetupStepIssueMessage(index, draft)}</span>
              </p>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <li className="relative">
      <div className="flex gap-2">
        <div className="flex w-6 shrink-0 flex-col items-center pt-0.5">
          <span className={nodeClass} aria-hidden>
            {complete ? <Check className="h-3 w-3 stroke-[2.75]" strokeLinecap="round" strokeLinejoin="round" aria-hidden /> : <span className="tabular-nums">{index + 1}</span>}
          </span>
          {!isLast ? <div className={connectorClass} aria-hidden /> : null}
        </div>

        <div
          className={cx(
            "min-w-0 flex-1 transition-colors",
            !isLast && "pb-[clamp(0.625rem,2vh,1.5rem)] lg:pb-[clamp(0.75rem,2.5vh,1.75rem)]",
            isLast && "pb-0",
          )}
        >
          {viewing ? (
            <div>
              {mainRow}
              {expanded}
            </div>
          ) : (
            mainRow
          )}
        </div>
      </div>
    </li>
  );
}
