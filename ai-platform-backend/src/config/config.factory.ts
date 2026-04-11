import { ENV_CHAT_WIDGET_API_KEY } from '../lib/env-var-names';

/**
 * Base hostnames allowed to call `/api/widget/preview/*` (browser `Origin`).
 * Subdomains of each entry are allowed (e.g. `assistrio.com` allows `app.assistrio.com`).
 * Production: assistrio.com only. Development: same plus loopback hosts for local UI preview.
 */
const PREVIEW_ALLOWED_BASE_HOSTS = ['assistrio.com'] as const;

const PREVIEW_DEV_EXTRA_HOSTS = ['localhost', '127.0.0.1', '::1'] as const;

/** Server-side list for `/api/widget/preview/*`. */
export function resolveAllowedPreviewHosts(nodeEnv: string): string[] {
  const base: string[] = [...PREVIEW_ALLOWED_BASE_HOSTS];
  if (nodeEnv !== 'development') return base;
  const seen = new Set(base.map((h) => h.trim().toLowerCase()).filter(Boolean));
  for (const h of PREVIEW_DEV_EXTRA_HOSTS) {
    const key = h.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      base.push(h);
    }
  }
  return base;
}

export function configFactory() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return {
    nodeEnv,
    port: parseInt(process.env.PORT ?? '3001', 10),
    mongodbUri: process.env.MONGODB_URI ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    jobRunnerSecret: process.env.JOB_RUNNER_SECRET ?? '',
    awsRegion: process.env.AWS_REGION ?? '',
    s3Bucket: process.env.S3_BUCKET ?? '',
    cloudfrontBaseUrl: process.env.CLOUDFRONT_BASE_URL?.trim().replace(/\/$/, '') ?? '',
    /**
     * Shared with assistrio-landing-site: marketing server calls send `X-API-Key` (public bots, trial request-access, contact, analytics track, etc.).
     * Same secret as landing `NEXT_LANDING_SITE_X_API_KEY` or `NEXT_ASSISTRIO_LANDING_SITE_X_API_KEY`.
     */
    landingSiteXApiKey: process.env.LANDING_SITE_X_API_KEY?.trim() ?? '',
    /** Shared secret for widget testing endpoints (header: X-API-Key). */
    chatWidgetApiKey: process.env[ENV_CHAT_WIDGET_API_KEY]?.trim() ?? '',
    /** See {@link resolveAllowedPreviewHosts} — assistrio.com; localhost only when `nodeEnv === 'development'`. */
    allowedPreviewHosts: resolveAllowedPreviewHosts(nodeEnv),
    /**
     * When true, loopback browser origins (localhost, 127.0.0.1, ::1, *.localhost) pass the runtime embed domain gate
     * without being listed on the bot. Users cannot save loopback as allowed domains.
     * Enabled only when NODE_ENV is development.
     */
    allowLoopbackEmbedOrigin: nodeEnv === 'development',
    resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
    /** Same origin visitors use for the marketing site (trial verify links). */
    landingPublicSiteUrl: process.env.LANDING_PUBLIC_SITE_URL?.trim() ?? '',
    contactFromEmail: process.env.CONTACT_FROM_EMAIL?.trim() ?? '',
    contactToEmail: process.env.CONTACT_TO_EMAIL?.trim() ?? '',
    trialFromEmail: process.env.TRIAL_FROM_EMAIL?.trim() ?? '',
  };
}

export type AppConfig = ReturnType<typeof configFactory>;
