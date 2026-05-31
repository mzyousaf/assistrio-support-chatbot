import { ENV_CHAT_WIDGET_API_KEY } from '../lib/env-var-names';
import { parseAppModeFromEnv, resolveEnableKbWorkerFromEnv, type AppMode } from './app-mode.util';

export function configFactory() {
  const appMode: AppMode = parseAppModeFromEnv();
  const enableKbWorker = resolveEnableKbWorkerFromEnv();
  return {
    appMode,
    /** Effective toggle for in-process KB/summary crons; always false in `api` mode. */
    enableKbWorker,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    mongodbUri: process.env.MONGODB_URI ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    /** Optional salt for analytics IP/UA hashing (falls back to `jwtSecret`). */
    analyticsHashSalt: process.env.ANALYTICS_HASH_SALT?.trim() ?? '',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    jobRunnerSecret: process.env.JOB_RUNNER_SECRET ?? '',
    /** Shared secret for landing site server-to-server calls (e.g. GET /api/public/landing/bots). */
    landingSiteBotsApiKey: process.env.LANDING_SITE_BOTS_API_KEY?.trim() ?? '',
    /** Shared secret for widget testing endpoints (header: X-API-Key or Authorization: Bearer). */
    chatWidgetApiKey: process.env[ENV_CHAT_WIDGET_API_KEY]?.trim() ?? '',
    /** Google OAuth (customer sign-in only). All must be set for `/api/customer/auth/google/*`. */
    googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? '',
    googleOauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? '',
    /** Registered in Google Cloud Console — must match exactly (e.g. `https://api.assistrio.com/api/customer/auth/google/callback`). */
    googleOauthRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ?? '',
    /** Customer web app origin, no trailing slash (e.g. `https://app.assistrio.com`). Used for post-OAuth redirects. */
    customerAppBaseUrl: process.env.CUSTOMER_APP_BASE_URL?.trim().replace(/\/$/, '') ?? '',
    adminAppBaseUrl: process.env.ADMIN_APP_BASE_URL?.trim().replace(/\/$/, '') ?? '',
    billingAlertEmail: process.env.BILLING_ALERT_EMAIL?.trim() ?? '',
    sendAssistrioPaymentReceiptEmail:
      process.env.SEND_ASSISTRIO_PAYMENT_RECEIPT_EMAIL === 'true' ||
      process.env.SEND_ASSISTRIO_PAYMENT_RECEIPT_EMAIL === '1',
    /** Lemon Squeezy billing — optional at boot; required at runtime for checkout/webhooks. */
    lemonSqueezyApiKey: process.env.LEMON_SQUEEZY_API_KEY?.trim() ?? '',
    lemonSqueezyStoreId: process.env.LEMON_SQUEEZY_STORE_ID?.trim() ?? '',
    lemonSqueezyWebhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET?.trim() ?? '',
    lemonSqueezyStarterMonthlyVariantId:
      process.env.LEMON_SQUEEZY_STARTER_MONTHLY_VARIANT_ID?.trim() ||
      process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID?.trim() ||
      '',
    lemonSqueezyStarterYearlyVariantId:
      process.env.LEMON_SQUEEZY_STARTER_YEARLY_VARIANT_ID?.trim() ?? '',
    lemonSqueezyProMonthlyVariantId:
      process.env.LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID?.trim() ||
      process.env.LEMON_SQUEEZY_PRO_VARIANT_ID?.trim() ||
      '',
    lemonSqueezyProYearlyVariantId: process.env.LEMON_SQUEEZY_PRO_YEARLY_VARIANT_ID?.trim() ?? '',
    lemonSqueezyAddonExtraBotMonthlyVariantId:
      process.env.LEMON_SQUEEZY_ADDON_EXTRA_BOT_MONTHLY_VARIANT_ID?.trim() ||
      process.env.LEMON_SQUEEZY_ADDON_EXTRA_BOT_VARIANT_ID?.trim() ||
      '',
    lemonSqueezyAddonExtraBotYearlyVariantId:
      process.env.LEMON_SQUEEZY_ADDON_EXTRA_BOT_YEARLY_VARIANT_ID?.trim() ?? '',
    lemonSqueezyAddonRemoveBrandingMonthlyVariantId:
      process.env.LEMON_SQUEEZY_ADDON_REMOVE_BRANDING_MONTHLY_VARIANT_ID?.trim() ||
      process.env.LEMON_SQUEEZY_ADDON_REMOVE_BRANDING_VARIANT_ID?.trim() ||
      '',
    lemonSqueezyAddonRemoveBrandingYearlyVariantId:
      process.env.LEMON_SQUEEZY_ADDON_REMOVE_BRANDING_YEARLY_VARIANT_ID?.trim() ?? '',
    lemonSqueezyTopup1000CreditsVariantId:
      process.env.LEMON_SQUEEZY_TOPUP_1000_CREDITS_VARIANT_ID?.trim() ?? '',
    lemonSqueezyAutoTopupVariantId:
      process.env.LEMON_SQUEEZY_AUTO_TOPUP_VARIANT_ID?.trim() ?? '',
    /** Resend API key for transactional email (workspace invites, etc.). */
    resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
    /** From address for transactional email (e.g. `Assistrio <noreply@assistrio.com>`). */
    emailFrom: process.env.EMAIL_FROM?.trim() ?? '',
    /** Optional reply-to for transactional email. */
    emailReplyTo: process.env.EMAIL_REPLY_TO?.trim() ?? '',
    /** Email logo mark URL (e.g. Google Drive direct image link). */
    emailLogoPath1: process.env.EMAIL_LOGO_PATH_1?.trim() ?? '',
    /** Email logo text/word URL (e.g. Google Drive direct image link). */
    emailLogoPath2: process.env.EMAIL_LOGO_PATH_2?.trim() ?? '',
    /** Optional support/contact page URL for transactional emails. */
    supportUrl: process.env.SUPPORT_URL?.trim() ?? '',
    /**
     * Optional `Domain` attribute for `ar_customer_session` only (e.g. `.assistrio.com`).
     * Unset → host-only cookie on the API host. Admin session cookies are unaffected.
     */
    sessionCookieDomain: process.env.SESSION_COOKIE_DOMAIN?.trim() ?? '',
    /**
     * POST /api/internal/admin-bootstrap/create-superadmin — header `x-admin-bootstrap-token`.
     * Leave unset to disable the endpoint (503).
     */
    adminBootstrapToken: process.env.ADMIN_BOOTSTRAP_TOKEN?.trim() ?? '',
    /** Max minutes since last KB touch (`updatedAt`, `lastQueuedAt`, …) before rows are ignored for pipeline-active flags on agent training/status. */
    agentTrainingPipelineStaleMinutes: (() => {
      const raw = process.env.AGENT_TRAINING_PIPELINE_STALE_MINUTES;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 1 && n <= 24 * 60 ? Math.floor(n) : 30;
    })(),
  };
}

export type AppConfig = ReturnType<typeof configFactory>;
