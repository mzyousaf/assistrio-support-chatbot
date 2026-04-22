import { ENV_CHAT_WIDGET_API_KEY } from '../lib/env-var-names';

export function configFactory() {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    mongodbUri: process.env.MONGODB_URI ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
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
    /**
     * POST /api/internal/admin-bootstrap/create-superadmin — header `x-admin-bootstrap-token`.
     * Leave unset to disable the endpoint (503).
     */
    adminBootstrapToken: process.env.ADMIN_BOOTSTRAP_TOKEN?.trim() ?? '',
  };
}

export type AppConfig = ReturnType<typeof configFactory>;
