import * as Joi from 'joi';
import { ENV_CHAT_WIDGET_API_KEY } from '../lib/env-var-names';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  MONGODB_URI: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(16).required(),
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
  /** Optional; when unset, admin bootstrap route returns 503. */
  ADMIN_BOOTSTRAP_TOKEN: Joi.string().optional().allow(''),
});
