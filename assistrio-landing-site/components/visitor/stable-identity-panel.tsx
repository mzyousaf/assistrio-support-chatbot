"use client";

import { useState } from "react";
import { usePlatformVisitorId } from "@/hooks/usePlatformVisitorId";
import { copyTextToClipboard } from "@/lib/utils/clipboard";
import { Card } from "@/components/ui/card";

type Props = {
  /** Larger title on homepage vs compact trial page */
  variant?: "default" | "compact";
  /** Softer, product-led copy for flows (workspace key vs raw API naming). */
  copyTone?: "default" | "workspace";
};

/**
 * Explains and surfaces the anonymous stable id (same semantics as backend `platformVisitorId`).
 * Treat like private access information: anyone with it can read quota summaries for this id.
 */
export function StableIdentityPanel({ variant = "default", copyTone = "default" }: Props) {
  const { platformVisitorId, status, queryParamRejected } = usePlatformVisitorId();
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    if (!platformVisitorId) return;
    const ok = await copyTextToClipboard(platformVisitorId);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  const isWorkspace = copyTone === "workspace";

  return (
    <Card className="border-[var(--border-default)] border-l-[3px] border-l-[var(--brand-teal)]/70 bg-gradient-to-br from-white via-white to-slate-50/50">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-teal-dark)]">
            {isWorkspace ? "Workspace" : "Stable identity"}
          </p>
          <h3
            className={
              variant === "compact"
                ? "mt-1 text-lg font-semibold text-slate-900"
                : "mt-2 font-[family-name:var(--font-display)] text-xl font-semibold text-slate-900 sm:text-2xl"
            }
          >
            {isWorkspace ? "Save this to continue later" : "Save this ID to reconnect anywhere"}
          </h3>
        </div>
        {status === "ready" && platformVisitorId ? (
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 self-start rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-teal-dark)] shadow-[var(--shadow-xs)] transition hover:border-[var(--border-teal-soft)] hover:bg-[var(--brand-teal-subtle)]"
          >
            {copied ? "Copied" : isWorkspace ? "Copy key" : "Copy ID"}
          </button>
        ) : null}
      </div>

      {queryParamRejected ? (
        <p className="mt-3 rounded-[var(--radius-lg)] border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          {isWorkspace ? (
            <>
              The key in the URL wasn&apos;t valid, so this browser generated a new workspace key. Paste a saved key below
              to restore your previous session.
            </>
          ) : (
            <>
              The <code className="rounded bg-white px-1">platformVisitorId</code> in the URL was not valid, so this browser
              generated a new id. Paste a saved id (Reconnect on the Explore page or homepage) to restore your previous
              context.
            </>
          )}
        </p>
      ) : null}

      <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
        {isWorkspace ? (
          <>
            <p>
              This is your <strong className="font-medium text-slate-800">workspace key</strong> — it ties Explore activity,
              quota, and demos to this browser session. It isn&apos;t your chat history; conversations in the widget use separate
              session ids.
            </p>
            <p>
              <strong className="font-medium text-slate-800">Save it</strong> in a password manager or secure note if you
              need the same workspace on another device. Treat it like a private reconnect credential.
            </p>
          </>
        ) : (
          <>
            <p>
              This browser stores one <strong className="font-medium text-slate-800">platform visitor id</strong> (
              <code className="rounded bg-slate-100 px-1 text-xs">platformVisitorId</code>) — the same string the API uses
              for evaluation bot ownership, quota, and gallery runtime demos. It is{" "}
              <strong className="font-medium text-slate-800">not</strong> your chat history; the widget creates chat
              sessions separately (<code className="rounded bg-slate-100 px-1 text-xs">chatVisitorId</code>).
            </p>
            <p>
              <strong className="font-medium text-slate-800">Reconnect on another device</strong> by opening a link that
              includes <code className="rounded bg-slate-100 px-1 text-xs">?platformVisitorId=…</code> with your saved id,
              or by pasting the id into your embed config later (same as backend &quot;reconnect&quot; contract).
            </p>
            <p>
              <strong className="font-medium text-slate-800">Treat it like a private access token.</strong> Anyone with
              this id can hit the same anonymous quota APIs (for example the usage summary). Allowed websites control{" "}
              <em>where</em> runtime may run — not <em>who</em> owns the id.
            </p>
            <p>
              <strong className="font-medium text-slate-800">Reconnect</strong> replaces the stored id in this browser —
              you are switching which anonymous bucket the marketing site uses (Explore bot create, quota, demos). Your
              production embed snippet carries its own{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">platformVisitorId</code>; update the snippet if you
              intentionally change which id should own runtime for that bot.
            </p>
          </>
        )}
      </div>

      <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-slate-50/90 p-4 shadow-[var(--shadow-xs)]">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{isWorkspace ? "Workspace key" : "Current id"}</p>
        {status === "loading" ? (
          <div className="mt-2 h-7 w-full max-w-md animate-pulse rounded bg-slate-200/80" />
        ) : (
          <code className="mt-2 block break-all font-mono text-sm text-slate-900">{platformVisitorId ?? "—"}</code>
        )}
      </div>
    </Card>
  );
}
