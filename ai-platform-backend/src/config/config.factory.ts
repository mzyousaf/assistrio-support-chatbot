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
    /** Shared secret for landing site server-to-server calls (e.g. GET /api/public/landing/bots). */
    landingSiteBotsApiKey: process.env.LANDING_SITE_BOTS_API_KEY?.trim() ?? '',
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
    /** Google OAuth (customer sign-in only). All must be set for `/api/customer/auth/google/*`. */
    googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? '',
    googleOauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? '',
    /** Registered in Google Cloud Console — must match exactly (e.g. `https://api.assistrio.com/api/customer/auth/google/callback`). */
    googleOauthRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ?? '',
    /** Customer web app origin, no trailing slash (e.g. `https://app.assistrio.com`). Used for post-OAuth redirects. */
    customerAppBaseUrl: process.env.CUSTOMER_APP_BASE_URL?.trim().replace(/\/$/, '') ?? '',
    /** Marketing site origin (optional; reserved for future redirects / allowlists). */
    landingSiteBaseUrl: process.env.LANDING_SITE_BASE_URL?.trim().replace(/\/$/, '') ?? '',
    /**
     * POST /api/internal/admin-bootstrap/create-superadmin — header `x-admin-bootstrap-token`.
     * Leave unset to disable the endpoint (503).
     */
    adminBootstrapToken: process.env.ADMIN_BOOTSTRAP_TOKEN?.trim() ?? '',
  };
}

export type AppConfig = ReturnType<typeof configFactory>;
