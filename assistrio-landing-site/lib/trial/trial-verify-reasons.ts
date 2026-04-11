export const trialVerifyReasonCopy = {
  missing: {
    title: "This link looks incomplete",
    body: "Open the full link from your email, or request a new access message from the homepage.",
  },
  invalid: {
    title: "This link isn’t valid",
    body: "It may have been copied incorrectly or is no longer active. You can request a fresh secure link anytime.",
  },
  expired: {
    title: "This link has expired",
    body: "For your security, access links only work for a limited time. Request a new one — it only takes a moment.",
  },
  used: {
    title: "This link was already used",
    body: "Each email link works once. Your browser should stay signed in on the device where you opened it. Need access again? Request a new link.",
  },
  session: {
    title: "Your session has ended",
    body: "Sign in again with a new access link from your email. We’ll send you a fresh one whenever you request it.",
  },
  config: {
    title: "We can’t complete that right now",
    body: "Setup isn’t fully configured on our side. Please try again in a few minutes or contact support if this continues.",
  },
  error: {
    title: "Something went wrong",
    body: "We couldn’t verify that link. Check your connection and try again, or request a new access email.",
  },
} as const satisfies Record<string, { title: string; body: string }>;

export type TrialVerifyReasonKey = keyof typeof trialVerifyReasonCopy;

export function isTrialVerifyReasonKey(k: string): k is TrialVerifyReasonKey {
  return k in trialVerifyReasonCopy;
}
