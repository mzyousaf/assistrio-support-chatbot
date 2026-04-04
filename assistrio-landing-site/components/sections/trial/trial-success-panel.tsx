"use client";

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
    body: "Save at least platformVisitorId (or reconnect with it) for quota and marketing flows on assistrio.com — not enough to embed on your domain alone.",
  },
  {
    label: "Your website runtime",
    body: "Use the full HTML snippet below — it already includes platformVisitorId, bot id, access key, and API base. Sharing it shares the same usage state as sharing the id + keys.",
  },
  {
    label: "Integrations",
    body: "Keep bot id + access key + platformVisitorId + allowlisted hostname together. The access key alone is not enough without the matching bot and domain rules.",
  },
];

/**
 * Post–trial creation handoff: credentials, preview vs runtime, save checklist, runtime snippet.
 */
export function TrialSuccessPanel({ trial }: Props) {
  return (
    <div className="space-y-10">
      <div className="rounded-[1.35rem] border border-emerald-200/90 bg-gradient-to-b from-emerald-50/95 via-white to-white px-6 py-8 shadow-[var(--shadow-md)] ring-1 ring-emerald-900/5 sm:px-8 sm:py-9">
        <p className="text-eyebrow text-emerald-900">Trial ready</p>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
          Your trial bot is live
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          This bot is tied to your <strong className="font-medium text-slate-800">stable id</strong> (
          <code className="rounded bg-white px-1 text-xs shadow-sm">platformVisitorId</code>). Save that string, your
          access key, and your allowed hostname — you need them to embed and to reconnect on another device. Treat them
          like private access material: anyone with them can use the same anonymous ownership and quota state.
        </p>
        <div className="mt-5 rounded-[var(--radius-lg)] border border-amber-200/90 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
          <strong className="font-medium">If you change the active id</strong> (Reconnect or{" "}
          <code className="rounded bg-white px-1 text-xs">?platformVisitorId=</code>) to something other than the id
          above, this success view closes — it only applies while this browser&apos;s saved id matches the bot owner id.
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Your bot snapshot</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
            Read-only numbers for this bot and your saved id — not a full dashboard. Use <strong className="font-medium text-slate-700">Update numbers</strong> anytime to refresh without leaving the page.
          </p>
        </div>
        <PvTrialBotSummary
          platformVisitorId={trial.platformVisitorId}
          botId={trial.bot.id}
          showHeaderHint={false}
        />
      </div>

      <div>
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
      </div>

      <Card className="border-[var(--border-teal-soft)] bg-white ring-1 ring-[var(--brand-teal)]/8">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Save these values</h3>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          The snippet duplicates some of these into{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">AssistrioChatConfig</code> for your site.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <CopyField label="Stable identity (platformVisitorId)" value={trial.platformVisitorId} />
          <CopyField label="Bot id" value={trial.bot.id} />
          <CopyField label="Access key" value={trial.bot.accessKey} />
          <CopyField label="Allowed hostname (runtime)" value={trial.allowedDomain} />
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

      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
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
          <h3 className="mt-2 text-base font-semibold text-slate-900">Runtime (your domain)</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
            Customer-facing chat runs only on <strong className="font-medium text-slate-800">{trial.allowedDomain}</strong>{" "}
            (or matching hostnames). The backend enforces the allowlist; your stable id selects which visitor quota bucket
            applies — domain rules alone are not ownership proof.
          </p>
        </Card>
      </div>

      <div className="rounded-[1.35rem] border border-[var(--border-default)] bg-gradient-to-b from-slate-50/90 to-white p-6 shadow-[var(--shadow-sm)] ring-1 ring-slate-900/[0.04] sm:p-8">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">Runtime embed snippet</h3>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Paste on your real site at a URL that matches the hostname you allowlisted. Chat threads use{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">chatVisitorId</code> inside the widget only — not in the
          snippet.
        </p>
        <div className="mt-6">
          <TrialRuntimeSnippet trial={trial} />
        </div>
      </div>

      <p className="text-center text-xs text-[var(--foreground-muted)]">
        Bot slug: <code className="font-mono text-slate-700">{trial.bot.slug}</code> — use in integrations. Gallery URLs
        on this site are for showcase bots, not visitor trials.
      </p>
    </div>
  );
}
