"use client";

import { useState } from "react";
import { usePlatformVisitorId } from "@/hooks/usePlatformVisitorId";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  variant?: "default" | "compact";
  /** Optional anchor id for the card root */
  id?: string;
};

/**
 * Explicit reconnect: user pastes a saved `platformVisitorId` to align this browser with the same anonymous bucket.
 * No server verification — knowing the id is sufficient for anonymous APIs (honest limitation).
 */
export function ReconnectSavedId({ variant = "default", id }: Props) {
  const { platformVisitorId, status, reconnectWithPlatformVisitorId } = usePlatformVisitorId();
  const { track } = useTrackEvent();
  const [input, setInput] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [justSwitched, setJustSwitched] = useState(false);

  const [replacedActiveId, setReplacedActiveId] = useState(false);

  function onApply(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setJustSwitched(false);
    setReplacedActiveId(false);
    const trimmed = input.trim();
    const previousId = platformVisitorId;
    if (trimmed) {
      track("reconnect_submitted", { variant });
    }
    const r = reconnectWithPlatformVisitorId(input);
    if (r.ok) {
      track("reconnect_succeeded", {
        variant,
        replacedActiveId: !!(previousId && previousId !== trimmed),
      });
      setInput("");
      setReplacedActiveId(!!previousId && previousId !== trimmed);
      setJustSwitched(true);
      window.setTimeout(() => setJustSwitched(false), 8000);
    } else {
      setLocalError(r.error);
    }
  }

  const isCompact = variant === "compact";

  return (
    <Card
      id={id}
      className={
        isCompact
          ? "border-[var(--border-default)] border-l-[3px] border-l-[var(--brand-teal)] bg-white"
          : "border-[var(--border-default)] border-l-[3px] border-l-[var(--brand-teal)] bg-gradient-to-b from-white to-slate-50/60"
      }
    >
      <h3
        className={
          isCompact
            ? "text-sm font-semibold text-slate-900"
            : "font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900"
        }
      >
        Reconnect with a saved ID
      </h3>
      <p className={`mt-2 text-[var(--foreground-muted)] ${isCompact ? "text-xs leading-relaxed" : "text-sm leading-relaxed"}`}>
        Paste the <strong className="font-medium text-slate-800">same</strong>{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">platformVisitorId</code> you saved from another device or
        bookmark. This browser will then use the <strong className="font-medium text-slate-800">same anonymous ownership
          and quota bucket</strong> as that id for landing features (usage summary, trial, demos). We only validate format
        and store locally — we do not verify “real-world” ownership (anyone with the string can assume this bucket).
      </p>
      <p className={`mt-2 text-[var(--foreground-muted)] ${isCompact ? "text-xs leading-relaxed" : "text-sm leading-relaxed"}`}>
        <strong className="font-medium text-slate-800">Intentional switch:</strong> Pasting a <em>different</em> id replaces
        the active id here. A trial success handoff below only stays visible while the active id matches the one that
        created the bot — it will clear if you switch away.
      </p>
      <form onSubmit={onApply} className={`mt-4 flex flex-col gap-3 ${isCompact ? "sm:flex-row sm:items-end" : ""}`}>
        <div className="min-w-0 flex-1">
          <label htmlFor="reconnect-platform-visitor-id" className="sr-only">
            Saved platform visitor id
          </label>
          <input
            id="reconnect-platform-visitor-id"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your saved platformVisitorId"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2.5 font-mono text-sm outline-none transition-shadow focus:border-[var(--border-teal-soft)] focus:ring-2 focus:ring-[var(--brand-teal)]/25"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button type="submit" className={isCompact ? "shrink-0" : ""} disabled={status !== "ready"}>
          Use this ID
        </Button>
      </form>
      {localError ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {localError}
        </p>
      ) : null}
      {justSwitched ? (
        <div className="mt-3 rounded-[var(--radius-lg)] border border-emerald-200/90 bg-emerald-50/90 px-3 py-2.5 text-sm text-emerald-900 shadow-[var(--shadow-xs)]">
          {replacedActiveId ? (
            <>
              <p className="font-medium text-emerald-950">Active id in this browser was replaced.</p>
              <p className="mt-1 text-emerald-900/95">
                Quota summary and trial/create flows below now use the id you pasted. If a trial “save” screen was open
                for a <em>different</em> id, it was cleared on purpose — recreate or paste the matching id to see it again.
              </p>
            </>
          ) : (
            <p>
              Applied. This browser was already on this id (or first apply). Usage summary below follows this id — same
              anonymous bucket as anyone else who knows the string.
            </p>
          )}
        </div>
      ) : null}
      {!isCompact && platformVisitorId && status === "ready" ? (
        <p className="mt-4 text-xs text-[var(--foreground-muted)]">
          Current id in this browser: <code className="break-all font-mono text-slate-700">{platformVisitorId}</code>
        </p>
      ) : null}
    </Card>
  );
}
