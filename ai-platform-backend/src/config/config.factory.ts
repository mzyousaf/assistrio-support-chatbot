import { ENV_CHAT_WIDGET_API_KEY, ENV_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE } from '../lib/env-var-names';

/**
 * Base hostnames allowed to call `/api/widget/preview/*` (browser Origin / Referer).
 * Subdomains of each entry are allowed (e.g. `assistrio.com` allows `app.assistrio.com`).
 */
const PREVIEW_ALLOWED_BASE_HOSTS = ['assistrio.com'] as const;

/** Merged in when NODE_ENV is development (subdomains of `localhost` match too). */
const PREVIEW_DEV_EXTRA_HOSTS = ['localhost', '127.0.0.1', '::1'] as const;

/** Server-side list: assistrio.com (+ localhost-style hosts in development only). */
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
    /** See {@link resolveAllowedPreviewHosts} — not configurable via env. */
    allowedPreviewHosts: resolveAllowedPreviewHosts(nodeEnv),
    /**
     * When true, loopback browser origins (localhost, 127.0.0.1, ::1, *.localhost) pass the runtime embed domain gate
     * without being listed on the bot. Users cannot save loopback as allowed domains.
     * Enabled only when NODE_ENV is development.
     */
    allowLoopbackEmbedOrigin: nodeEnv === 'development',
    /**
     * Runtime embed: max combined requests per minute per IP (widget init + chat endpoints that enforce embed domain).
     * `0` = disabled. In-process only; multi-instance deployments should use a shared limiter or edge rate limits.
     */
    widgetEmbedRateLimitPerMinute: Math.max(
      0,
      parseInt(process.env[ENV_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE] ?? '0', 10) || 0,
    ),
  };
}

export type AppConfig = ReturnType<typeof configFactory>;
