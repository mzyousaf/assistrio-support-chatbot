"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CopyField } from "@/components/ui/copy-field";
import { Card } from "@/components/ui/card";
import { TrialRuntimeSnippet } from "@/components/sections/trial/trial-runtime-snippet";
import { PvTrialBotSummary } from "@/components/visitor/pv-trial-bot-summary";
import type { TrialCreateResponse } from "@/types/api";

type Props = {
  trial: TrialCreateResponse;
};

const saveTiers = [
  {
    label: "This site only",
    body: "Save at least platformVisitorId (or reconnect with it) for quota and marketing flows on assistrio.com — not enough to embed on your allowed website alone.",
  },
  {
    label: "Your website runtime",
    body: "Use the full HTML snippet below — it already includes platformVisitorId, AI Agent id, access key, and API base. Sharing it shares the same usage state as sharing the id + keys.",
  },
  {
    label: "Integrations",
    body: "Keep AI Agent id + access key + platformVisitorId + allowed website (hostname) together. The access key alone is not enough without the matching AI Agent and allowed website rules.",
  },
];

const spring = { type: "spring", stiffness: 380, damping: 34 } as const;

const easeSoft = [0.22, 1, 0.36, 1] as const;

function SuccessConfetti() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  const pieces = Array.from({ length: 16 }, (_, i) => ({
    id: i,
    left: `${(i * 41 + 7) % 86}%`,
    delay: 0.06 + i * 0.035,
    hue: i % 3,
  }));
  const colors = ["bg-emerald-400/95", "bg-teal-300/90", "bg-cyan-200/90"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className={`absolute top-0 h-1.5 w-1.5 rounded-sm ${colors[p.hue]}`}
          style={{ left: p.left }}
          initial={{ y: -6, opacity: 0, rotate: 0 }}
          animate={{ y: 140, opacity: [0, 1, 1, 0], rotate: 220 }}
          transition={{ duration: 1.85, delay: p.delay, ease: [0.22, 0.61, 0.36, 1] }}
        />
      ))}
    </div>
  );
}

/**
 * Post–trial creation handoff: credentials, preview vs runtime, save checklist, runtime snippet.
 */
export function TrialSuccessPanel({ trial }: Props) {
  const reduceMotion = useReducedMotion();
  const blockVariants = reduceMotion
    ? {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.22, ease: easeSoft } },
      }
    : {
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: spring },
      };

  return (
    <div className="space-y-10">
      <p className="sr-only" role="status">
        Explore AI Support Agent created successfully. Your evaluation AI Support Agent is live. Save your workspace key and embed snippet below.
      </p>
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          reduceMotion ? { duration: 0.28, ease: easeSoft } : { duration: 0.45, ease: easeSoft }
        }
        className="relative overflow-hidden rounded-[1.35rem] border border-emerald-200/90 bg-gradient-to-b from-emerald-50/95 via-white to-white px-6 py-8 shadow-[var(--shadow-md)] ring-1 ring-emerald-900/5 sm:px-8 sm:py-9"
      >
        {!reduceMotion ? <div className="success-hero-glow" /> : null}
        <SuccessConfetti />
        <div className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/90 bg-white shadow-[var(--shadow-sm)]">
                <motion.svg
                  viewBox="0 0 24 24"
                  className="h-8 w-8 text-emerald-600"
                  aria-hidden
                  initial={reduceMotion ? { opacity: 1 } : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={
                    reduceMotion
                      ? { duration: 0.15 }
                      : { type: "spring", stiffness: 420, damping: 22, delay: 0.08 }
                  }
                >
                  <motion.path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: reduceMotion ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { duration: 0.55, ease: easeSoft, delay: 0.22 }
                    }
                  />
                </motion.svg>
              </div>
              <div>
                <p className="text-eyebrow text-emerald-900">Explore ready</p>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
                  Your evaluation AI Support Agent is live
                </h2>
              </div>
            </div>
          </div>
          <motion.p
            className="relative mt-4 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: reduceMotion ? 0.08 : 0.35,
              duration: reduceMotion ? 0.22 : 0.4,
              ease: easeSoft,
            }}
          >
            This AI Support Agent is tied to your <strong className="font-medium text-slate-800">workspace key</strong> (shown below as{" "}
            <code className="rounded bg-white px-1 text-xs shadow-sm">platformVisitorId</code> for integrations). Save it
            with your access key and allowed hostname — you need them to embed and to reconnect on another device. Treat
            them like private access material: anyone with them can use the same anonymous ownership and quota state.
          </motion.p>
          <motion.div
            className="relative mt-5 rounded-[var(--radius-lg)] border border-amber-200/90 bg-amber-50/70 px-4 py-3 text-sm text-amber-950"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: reduceMotion ? 0.12 : 0.48,
              duration: reduceMotion ? 0.22 : 0.4,
              ease: easeSoft,
            }}
          >
            <strong className="font-medium">If you change the active id</strong> (Reconnect or{" "}
            <code className="rounded bg-white px-1 text-xs">?platformVisitorId=</code>) to something other than the id
            above, this success view closes — it only applies while this browser&apos;s saved id matches the AI Agent owner id.
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        className="space-y-4"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: {
            transition: {
              staggerChildren: reduceMotion ? 0.04 : 0.1,
              delayChildren: reduceMotion ? 0.05 : 0.15,
            },
          },
        }}
      >
        <motion.div variants={blockVariants}>
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Your AI Agent snapshot</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
              Read-only numbers for this AI Agent and your saved id — not a full dashboard. Use{" "}
              <strong className="font-medium text-slate-700">Update numbers</strong> anytime to refresh without leaving the
              page.
            </p>
          </div>
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white/80 p-1 shadow-[var(--shadow-xs)] ring-1 ring-slate-900/[0.04]">
            <PvTrialBotSummary platformVisitorId={trial.platformVisitorId} botId={trial.bot.id} showHeaderHint={false} />
          </div>
        </motion.div>

        <motion.div variants={blockVariants}>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Recommended save package</h3>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Pick what you need for each surface — there is no encryption; saving is your responsibility.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {saveTiers.map((t) => (
              <div
                key={t.label}
                className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-4 shadow-[var(--shadow-xs)] sm:p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">{t.label}</p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--foreground-muted)]">{t.body}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={blockVariants}>
          <Card className="border-[var(--border-teal-soft)] bg-white ring-1 ring-[var(--brand-teal)]/8">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Save these values</h3>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              The snippet duplicates some of these into{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">AssistrioChatConfig</code> for your site.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <CopyField label="Workspace key (platformVisitorId)" value={trial.platformVisitorId} />
              <CopyField label="AI Agent id" value={trial.bot.id} />
              <CopyField label="Access key" value={trial.bot.accessKey} />
              <CopyField label="Allowed website (hostname)" value={trial.allowedDomain} />
            </div>
            <div className="mt-6 rounded-[var(--radius-lg)] border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-[var(--foreground-muted)]">
              <ul className="space-y-2">
                <li>
                  <strong className="font-medium text-slate-800">Bookmark</strong> this page or store the id in a password
                  manager — <code className="rounded bg-white px-1 text-xs">localStorage</code> alone won&apos;t sync across
                  devices.
                </li>
                <li>
                  <strong className="font-medium text-slate-800">Reconnect elsewhere</strong> — use{" "}
                  <strong className="font-medium text-slate-800">Reconnect with a saved ID</strong> on the trial or home
                  page, or open an Assistrio URL with{" "}
                  <code className="rounded bg-white px-1 text-xs">?platformVisitorId=…</code>.
                </li>
              </ul>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={blockVariants} className="grid gap-5 md:grid-cols-2 md:gap-6">
          <Card className="border-[var(--border-default)] bg-slate-50/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assistrio-only</p>
            <h3 className="mt-2 text-base font-semibold text-slate-900">Preview</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
              Owners test drafts and configuration inside Assistrio-hosted preview — not on your public site. This landing
              page does not embed preview mode.
            </p>
          </Card>
          <Card className="border-[var(--border-teal-soft)] bg-[var(--brand-teal-subtle)]/25 ring-1 ring-[var(--brand-teal)]/12">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">Your traffic</p>
            <h3 className="mt-2 text-base font-semibold text-slate-900">Runtime (your allowed website)</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
              Customer-facing chat runs only on <strong className="font-medium text-slate-800">{trial.allowedDomain}</strong>{" "}
              (and matching hostnames under your allowed website rules). The backend enforces allowed websites; your stable id selects which visitor quota bucket
              applies — allowed website rules alone are not ownership proof.
            </p>
          </Card>
        </motion.div>

        <motion.div
          variants={blockVariants}
          className="rounded-[1.35rem] border border-[var(--border-default)] bg-gradient-to-b from-slate-50/90 to-white p-6 shadow-[var(--shadow-sm)] ring-1 ring-slate-900/[0.04] sm:p-8"
        >
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Runtime embed snippet</h3>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Paste on your real site at a URL that matches the allowed website you configured. Chat threads use{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">chatVisitorId</code> inside the widget only — not in the
            snippet.
          </p>
          <div className="mt-6">
            <TrialRuntimeSnippet trial={trial} />
          </div>
        </motion.div>
      </motion.div>

      <motion.p
        className="text-center text-xs text-[var(--foreground-muted)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduceMotion ? 0.2 : 0.85, duration: reduceMotion ? 0.2 : 0.45 }}
      >
        AI Agent slug: <code className="font-mono text-slate-700">{trial.bot.slug}</code> — use in integrations. Gallery URLs
        on this site are for showcase AI Agents, not visitor trials.
      </motion.p>
    </div>
  );
}
