/**
 * Environment variable names used by the backend (single place to rename / document).
 * Values are loaded from `.env` / deployment; see `ai-platform-backend/.env.example`.
 */
export const ENV_CHAT_WIDGET_API_KEY = 'CHAT_WIDGET_API_KEY' as const;

/** Max requests per minute per client IP for runtime embed (`/api/widget/init`, `/api/chat/*` with embed gate). `0` = disabled. */
export const ENV_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE = 'WIDGET_EMBED_RATE_LIMIT_PER_MINUTE' as const;
