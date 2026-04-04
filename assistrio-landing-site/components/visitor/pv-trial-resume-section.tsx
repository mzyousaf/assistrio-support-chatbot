"use client";

import { PvTrialBotSummary } from "@/components/visitor/pv-trial-bot-summary";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PvLastTrialBotRef } from "@/lib/identity/pv-last-trial-bot";

type Props = {
  refData: PvLastTrialBotRef;
  onForget: () => void;
};

function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Lightweight revisit: PV-safe snapshot when this browser remembers a bot for the current saved id.
 */
export function PvTrialResumeSection({ refData, onForget }: Props) {
  return (
    <Card className="overflow-hidden border-[var(--border-teal-soft)] bg-gradient-to-b from-[var(--brand-teal-subtle)]/25 to-white ring-1 ring-[var(--brand-teal)]/12">
      <div className="p-6 sm:p-7">
        <p className="text-eyebrow text-[var(--brand-teal-dark)]">Saved on this device</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Your last trial bot
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--foreground-muted)]">
          We keep a <strong className="font-medium text-slate-800">browser-only</strong> pointer to the bot you created
          last while this <strong className="font-medium text-slate-800">saved id</strong> was active. It isn&apos;t an
          account and doesn&apos;t sync — reconnect with a different id and this clears.
        </p>
        {refData.savedAt ? (
          <p className="mt-3 text-xs text-slate-500">
            Reference saved: <span className="tabular-nums text-slate-600">{formatSavedAt(refData.savedAt)}</span>
          </p>
        ) : null}

        <div className="mt-8 border-t border-[var(--border-default)] pt-8">
          <PvTrialBotSummary platformVisitorId={refData.platformVisitorId} botId={refData.botId} />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-[var(--border-default)] bg-slate-50/50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="max-w-md text-xs leading-relaxed text-[var(--foreground-muted)]">
          Starting over or the wrong bot? Remove the remembered reference for this browser only. To create another bot,
          continue with the steps below.
        </p>
        <Button type="button" variant="ghost" className="shrink-0 self-start sm:self-center" onClick={onForget}>
          Forget this bot
        </Button>
      </div>
    </Card>
  );
}
