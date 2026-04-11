import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TrialVerifyAuto } from "@/components/trial/trial-verify-auto";
import { TrialVerifyFailurePanel } from "@/components/trial/trial-verify-failure-panel";
import { validateTrialDashboardSession } from "@/lib/server/trial-session";
import { isTrialVerifyReasonKey, type TrialVerifyReasonKey } from "@/lib/trial/trial-verify-reasons";

/** Aligned with Nest magic-link input bounds. */
const MAX_MAGIC_TOKEN_LEN = 200;

export const metadata: Metadata = {
  title: "Continue setup",
  robots: { index: false, follow: false },
};

/** Avoid cached HTML shell so a new `?t=` after a prior error visit always runs a fresh server render + client verify. */
export const dynamic = "force-dynamic";

/**
 * Magic-link entry: with `?t=` auto-verifies (POST on client), then redirects to dashboard or error.
 * Valid trial session → skip verify and go to dashboard (does not consume the magic link).
 * With `?reason=` shows a friendly state after a failed verify or missing session.
 */
export default async function TrialVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[]; reason?: string | string[] }>;
}) {
  const sp = await searchParams;
  const rawT = sp?.t;
  const token = Array.isArray(rawT) ? rawT[0] : rawT;
  const rawReason = sp?.reason;
  const reasonParam = Array.isArray(rawReason) ? rawReason[0] : rawReason;

  const hasToken = typeof token === "string" && token.trim().length > 0;
  const reasonRaw = typeof reasonParam === "string" ? reasonParam.trim() : "";
  const reasonKey: TrialVerifyReasonKey | null =
    reasonRaw && isTrialVerifyReasonKey(reasonRaw) ? reasonRaw : reasonRaw ? "error" : null;

  if (hasToken && reasonKey) {
    redirect(`/trial/verify?reason=${reasonKey}`);
  }

  const trimmedToken = typeof token === "string" ? token.trim() : "";
  if (hasToken && !reasonKey && trimmedToken.length > MAX_MAGIC_TOKEN_LEN) {
    redirect("/trial/verify?reason=invalid");
  }

  const fallback = !hasToken && !reasonKey;
  const resolvedReason: TrialVerifyReasonKey = reasonKey ?? (fallback ? "missing" : "error");

  if (hasToken && !reasonKey) {
    const existingSession = await validateTrialDashboardSession();
    if (existingSession) {
      redirect("/trial/dashboard");
    }

    return <TrialVerifyAuto key={trimmedToken} token={trimmedToken} />;
  }

  return <TrialVerifyFailurePanel reasonKey={resolvedReason} />;
}
