/**
 * Context captured when a trial CTA opens the modal — used for analytics continuity
 * and for Prompt 2+ (lead API, magic link).
 */
export type TrialCtaOpenContext = {
  /** Button or link text at click time */
  label: string;
  /** Analytics bucket, e.g. `home_hero`, `footer` */
  location: string;
  /** Canonical path the CTA represents, e.g. `/trial` */
  href: string;
  /** Route pathname when the modal was opened */
  sourcePath: string;
  /** Showcase gallery bot slug when the CTA is on a bot detail page */
  showcaseSlug: string | null;
  /** Public bot id when known (e.g. showcase detail) */
  showcaseBotId: string | null;
};

export type TrialCtaOpenPayload = {
  label: string;
  location: string;
  href: string;
  showcaseSlug?: string | null;
  showcaseBotId?: string | null;
};

const DEFAULT_CONTEXT: Omit<TrialCtaOpenContext, "sourcePath"> = {
  label: "Try Assistrio",
  location: "unknown",
  href: "/trial",
  showcaseSlug: null,
  showcaseBotId: null,
};

export function buildTrialCtaOpenContext(
  sourcePath: string,
  payload?: Partial<TrialCtaOpenPayload> | null,
): TrialCtaOpenContext {
  const p = payload ?? {};
  return {
    label: typeof p.label === "string" && p.label.trim() ? p.label.trim() : DEFAULT_CONTEXT.label,
    location:
      typeof p.location === "string" && p.location.trim() ? p.location.trim() : DEFAULT_CONTEXT.location,
    href: typeof p.href === "string" && p.href.trim() ? p.href.trim() : DEFAULT_CONTEXT.href,
    sourcePath: sourcePath || "/",
    showcaseSlug:
      p.showcaseSlug === undefined || p.showcaseSlug === null
        ? null
        : String(p.showcaseSlug).trim() || null,
    showcaseBotId:
      p.showcaseBotId === undefined || p.showcaseBotId === null
        ? null
        : String(p.showcaseBotId).trim() || null,
  };
}

/** Payload emitted after a successful step-1 submit (Prompt 2: wire to API + email). */
export type TrialLeadCaptureSuccessPayload = {
  name: string;
  email: string;
  platformVisitorId: string | null;
  platformVisitorReady: boolean;
  cta: TrialCtaOpenContext;
};
