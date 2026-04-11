import * as Joi from 'joi';
import { ENV_CHAT_WIDGET_API_KEY } from '../lib/env-var-names';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  MONGODB_URI: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(16).required(),
  OPENAI_API_KEY: Joi.string().required(),
  JOB_RUNNER_SECRET: Joi.string().min(16).required(),
  AWS_REGION: Joi.string().optional(),
  S3_BUCKET: Joi.string().optional(),
  CLOUDFRONT_BASE_URL: Joi.string().uri().optional().allow(''),
  /**
   * Marketing site server-to-server: `X-API-Key` for public bots, landing trial/contact, analytics track, etc.
   */
  LANDING_SITE_X_API_KEY: Joi.string().optional().allow(''),
  /** Resend — outbound email from Nest (trial + contact). */
  RESEND_API_KEY: Joi.string().optional().allow(''),
  /** Marketing site origin for `/trial/verify` links (e.g. https://www.assistrio.com). Must match public site URL. */
  LANDING_PUBLIC_SITE_URL: Joi.string().uri().optional().allow(''),
  CONTACT_FROM_EMAIL: Joi.string().optional().allow(''),
  CONTACT_TO_EMAIL: Joi.string().optional().allow(''),
  TRIAL_FROM_EMAIL: Joi.string().optional().allow(''),
  /** Auth for widget-only testing endpoints (returns an embeddable botId). */
  [ENV_CHAT_WIDGET_API_KEY]: Joi.string().min(16).optional().allow(''),
});
