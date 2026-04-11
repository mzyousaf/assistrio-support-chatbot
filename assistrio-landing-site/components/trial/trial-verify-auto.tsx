"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { TrialWorkspaceLoadingCenter } from "@/components/trial/dashboard/trial-workspace-loading-center";
import { TrialVerifyFailurePanel } from "@/components/trial/trial-verify-failure-panel";
import {
  hasTrialVerifyDashboardSucceeded,
  markTrialVerifyDashboardSucceeded,
  verifyTrialSessionOnce,
} from "@/lib/trial/trial-verify-once";
import { type TrialVerifyReasonKey } from "@/lib/trial/trial-verify-reasons";

type Phase = "loading" | "error";

type Props = {
  token: string;
};

/**
 * POSTs the magic token once per token via {@link verifyTrialSessionOnce} (Strict Mode–safe),
 * shows workflow-style loading, then redirects to the dashboard or a centered error state.
 */
export function TrialVerifyAuto({ token }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [reasonKey, setReasonKey] = useState<TrialVerifyReasonKey>("error");

  /**
   * Next.js can reuse this client component when only `?t=` changes (soft navigation). Without a reset,
   * `phase === "error"` from a previous token persists — user sees the old failure until a full reload.
   * Parent also passes `key={token}`; this covers cases where the key is omitted.
   */
  useLayoutEffect(() => {
    setPhase("loading");
    setReasonKey("error");
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const goDashboard = (href: string) => {
      markTrialVerifyDashboardSucceeded(token);
      if (cancelled) return;
      window.location.assign(href);
    };

    const applyError = (reason: TrialVerifyReasonKey) => {
      if (cancelled) return;
      if (hasTrialVerifyDashboardSucceeded(token)) {
        window.location.assign(new URL("/trial/dashboard", window.location.origin).href);
        return;
      }
      setReasonKey(reason);
      setPhase("error");
    };

    (async () => {
      const outcome = await verifyTrialSessionOnce(token);

      if (outcome.kind === "aborted") {
        return;
      }

      if (hasTrialVerifyDashboardSucceeded(token)) {
        goDashboard(new URL("/trial/dashboard", window.location.origin).href);
        return;
      }

      if (outcome.kind === "dashboard") {
        goDashboard(outcome.href);
        return;
      }

      if (outcome.kind === "unknown_redirect") {
        if (cancelled) return;
        window.location.assign(outcome.location);
        return;
      }

      if (outcome.kind === "http_error") {
        applyError("error");
        return;
      }

      if (outcome.kind === "verify_reason") {
        if (outcome.reason === "used") {
          try {
            const r = await fetch("/api/trial/session-check", { credentials: "same-origin" });
            if (cancelled) return;
            if (r.ok) {
              goDashboard(new URL("/trial/dashboard", window.location.origin).href);
              return;
            }
          } catch {
            /* network — fall through */
          }
        }
        applyError(outcome.reason);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (phase === "loading") {
    return (
      <div className="flex w-full flex-col items-center justify-center px-2 py-4 sm:py-6">
        <TrialWorkspaceLoadingCenter
          message="Verifying…"
          variant="inline"
          subtitle="Checking your secure link"
        />
      </div>
    );
  }

  return <TrialVerifyFailurePanel reasonKey={reasonKey} />;
}
