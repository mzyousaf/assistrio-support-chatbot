import * as Joi from 'joi';
import { ENV_CHAT_WIDGET_API_KEY } from '../lib/env-var-names';

export const configValidationSchema = Joi.object({
  /**
   * `all` = monolith (default, local dev). `api` = HTTP API only, no in-process KB/summary crons.
   * `worker` = use `WorkerAppModule` from `main.ts` (dedicated process; crons if ENABLE_KB_WORKER allows).
   * `runtime` = public embed + chat + analytics track only via `RuntimeAppModule` (no dashboard CRUD, no crons).
   */
  APP_MODE: Joi.string().valid('all', 'api', 'worker', 'runtime').default('all'),
  /**
   * When `true` (default in all/worker, never in `api` or `runtime`), the process may run `JobsCronService` when also registered
   * (see `shouldRegisterKbInProcessCronsForAppModule` / `shouldRegisterKbInProcessCronsForWorkerApp`).
   */
  ENABLE_KB_WORKER: Joi.string().valid('true', 'false', '1', '0', 'yes', 'no', '').optional().allow(''),
  /** Global default for structured KB cron JSON logs when per-cron `KB_CRON_LOG_*` vars are unset. Only `true` enables. */
  KB_CRON_LOGS: Joi.string().valid('true', 'false', '1', '0', '').optional().allow(''),
  KB_CRON_LOG_CONTENT_EXTRACTION: Joi.string().valid('true', 'false', '').optional().allow(''),
  KB_CRON_LOG_KNOWLEDGE_TRAINING: Joi.string().valid('true', 'false', '').optional().allow(''),
  KB_CRON_LOG_TABLE_IMPORT: Joi.string().valid('true', 'false', '').optional().allow(''),
  KB_CRON_LOG_SUMMARY_JOBS: Joi.string().valid('true', 'false', '').optional().allow(''),
  KB_CRON_LOG_KNOWLEDGE_PURGE: Joi.string().valid('true', 'false', '').optional().allow(''),
  KB_CRON_LOG_BOT_PURGE: Joi.string().valid('true', 'false', '').optional().allow(''),
  KB_CRON_LOG_BACKFILL: Joi.string().valid('true', 'false', '').optional().allow(''),
  KB_CRON_LOG_APP_BOOT: Joi.string().valid('true', 'false', '').optional().allow(''),
  /**
   * When `NODE_ENV=production` and `APP_MODE=all`, must be `true`/`1`/`yes` or the process exits.
   * Ignored in non-production. Local `APP_MODE=all` does not need this.
   */
  ALLOW_APP_MODE_ALL_IN_PRODUCTION: Joi.string().valid('true', 'false', '1', '0', 'yes', 'no', '').optional().allow(''),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  MONGODB_URI: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(16).required(),
  /** Optional; when unset, analytics hashing uses `JWT_SECRET`. */
  ANALYTICS_HASH_SALT: Joi.string().optional().allow(''),
  OPENAI_API_KEY: Joi.string().required(),
  JOB_RUNNER_SECRET: Joi.string().min(16).required(),
  LANDING_SITE_BOTS_API_KEY: Joi.string().optional().allow(''),
  /** Auth for widget-only testing endpoints (returns an embeddable botId). */
  [ENV_CHAT_WIDGET_API_KEY]: Joi.string().min(16).optional().allow(''),
  /** Customer Google OAuth — optional at boot; required at runtime when OAuth routes are used. */
  GOOGLE_OAUTH_CLIENT_ID: Joi.string().optional().allow(''),
  GOOGLE_OAUTH_CLIENT_SECRET: Joi.string().optional().allow(''),
  /** Must match Google Cloud Console exactly (any non-empty string when OAuth is used). */
    GOOGLE_OAUTH_REDIRECT_URI: Joi.string().optional().allow(''),
  CUSTOMER_APP_BASE_URL: Joi.string().optional().allow(''),
  TOPIC_SENTIMENT_MODEL: Joi.string().optional().allow(''),
  TOPIC_SENTIMENT_TIMEOUT_MS: Joi.string().optional().allow(''),
  /** Minutes without Mongo activity before KB rows stop counting as pipeline-active on GET `/knowledge/training/status` (presentation-only). */
    AGENT_TRAINING_PIPELINE_STALE_MINUTES: Joi.number().integer().min(1).max(1440).default(30),
    /** Optional; when unset, admin bootstrap route returns 503. */
  ADMIN_BOOTSTRAP_TOKEN: Joi.string().optional().allow(''),
});
