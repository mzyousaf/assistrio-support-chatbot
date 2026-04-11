"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useTrialWorkspaceDraft } from "@/components/trial/dashboard/trial-workspace-draft-context";
import { apiDraftJsonToTrialWorkspaceDraftV3 } from "@/lib/trial/trial-draft-sync";
import { fetchTrialCreateAgent } from "@/lib/trial/trial-create-agent-api";
import { useTrialDashboardToast } from "@/components/trial/dashboard/trial-dashboard-toast";

const PHASES = [
  { label: "Preparing your assistant", sub: "Locking in name, brand color, and avatar from your profile" },
  { label: "Applying behavior & brand", sub: "Turning your description into how your AI Agent replies" },
  { label: "Organizing knowledge", sub: "Connecting text snippets and files you added in onboarding" },
  { label: "Configuring website access", sub: "Setting where your widget is allowed to run" },
  { label: "Finalizing workspace", sub: "Creating your trial agent and unlocking Playground" },
] as const;

type PhaseIndex = 0 | 1 | 2 | 3 | 4;

/** Dedupes overlapping calls (e.g. React Strict Mode double effect) while a create is in flight. */
let trialCreateSingleton: Promise<void> | null = null;

export function TrialCreatingAgentStepBody() {
  const router = useRouter();
  const { replaceDraft, draft } = useTrialWorkspaceDraft();
  const { showToast } = useTrialDashboardToast();
  const [phase, setPhase] = useState<PhaseIndex>(0);
  const [failed, setFailed] = useState(false);
  const [working, setWorking] = useState(true);
  const inFlight = useRef(false);

  const runCreate = useCallback(async () => {
    if (inFlight.current) return;
    if (trialCreateSingleton) {
      await trialCreateSingleton;
      return;
    }
    inFlight.current = true;
    setFailed(false);
    setWorking(true);
    trialCreateSingleton = (async () => {
      try {
        const out = await fetchTrialCreateAgent();
        replaceDraft(apiDraftJsonToTrialWorkspaceDraftV3(out.draft));
        router.replace("/trial/dashboard/playground/profile");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        setFailed(true);
        showToast({ message: msg, variant: "error" });
      } finally {
        setWorking(false);
        inFlight.current = false;
      }
    })().finally(() => {
      trialCreateSingleton = null;
    });
    await trialCreateSingleton;
  }, [replaceDraft, router, showToast]);

  useEffect(() => {
    if (draft.trialAgent?.botId) {
      router.replace("/trial/dashboard/playground/profile");
      return;
    }
    void runCreate();
  }, [draft.trialAgent?.botId, router, runCreate]);

  useEffect(() => {
    if (failed || !working) return;
    const t = window.setInterval(() => {
      setPhase((p) => (p >= 4 ? 4 : ((p + 1) as PhaseIndex)));
    }, 1400);
    return () => window.clearInterval(t);
  }, [failed, working]);

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-[var(--border-teal-soft)]/50 bg-gradient-to-br from-white via-teal-50/45 to-white px-6 py-10 text-center shadow-[var(--shadow-md)] sm:px-10 sm:py-12"
      >
        <motion.div
          className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-[var(--brand-teal)]/10 blur-3xl"
          animate={{ opacity: [0.4, 0.75, 0.4], scale: [1, 1.08, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
          {working && !failed ? (
            <Loader2 className="h-10 w-10 animate-spin text-[var(--brand-teal)]" aria-hidden />
          ) : (
            <span className="text-2xl" aria-hidden>
              ✦
            </span>
          )}
        </div>

        <p className="relative mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-teal-dark)]">
          Assistrio AI
        </p>
        <h2 className="relative mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]">
          {failed ? "We couldn’t finish creating your AI Agent" : "Creating your AI Agent"}
        </h2>
        <p className="relative mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[var(--foreground-muted)] sm:text-[15px]">
          {failed
            ? "Your onboarding draft is still saved. Check the notification for details—you can try again without losing progress."
            : "Hang tight—we’re provisioning your trial agent from the setup you completed."}
        </p>

        {failed ? (
          <div className="relative mx-auto mt-6 max-w-md">
            <button
              type="button"
              disabled={working}
              className="w-full rounded-xl bg-[var(--brand-teal)] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--brand-teal-hover)] disabled:opacity-60"
              onClick={() => void runCreate()}
            >
              {working ? "Trying again…" : "Try again"}
            </button>
          </div>
        ) : null}
      </motion.div>

      {!failed ? (
        <div className="rounded-2xl border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-sm)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">Progress</p>
          <ul className="mt-4 space-y-4">
            {PHASES.map((phaseItem, i) => {
              const isActive = i === phase;
              const isDone = i < phase;
              return (
                <motion.li
                  key={phaseItem.label}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 * i, duration: 0.35 }}
                  className={`flex gap-4 rounded-xl border p-3 transition-colors ${isActive
                      ? "border-[var(--brand-teal)]/40 bg-[var(--brand-teal-faint)]/50 shadow-[0_0_0_1px_rgba(13,148,136,0.08)]"
                      : "border-transparent bg-transparent"
                    }`}
                >
                  <div className="flex flex-col items-center pt-0.5">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isDone
                          ? "bg-emerald-600 text-white"
                          : isActive
                            ? "bg-slate-900 text-white ring-2 ring-[var(--brand-teal)]/40"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      aria-hidden
                    >
                      {isDone ? "✓" : i + 1}
                    </div>
                    {i < PHASES.length - 1 ? (
                      <div
                        className={`mt-1 min-h-[1rem] w-px grow ${isDone ? "bg-emerald-300" : "bg-slate-200"}`}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-0.5">
                    <p className="font-semibold text-slate-900">{phaseItem.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">{phaseItem.sub}</p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--brand-teal)] to-emerald-500"
                        initial={{ width: 0 }}
                        animate={{
                          width: isActive ? "72%" : isDone ? "100%" : "12%",
                        }}
                        transition={{ duration: isActive ? 1.8 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
