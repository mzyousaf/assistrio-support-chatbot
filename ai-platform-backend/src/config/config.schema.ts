import * as Joi from 'joi';
import { ENV_CHAT_WIDGET_API_KEY, ENV_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE } from '../lib/env-var-names';

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
  LANDING_SITE_BOTS_API_KEY: Joi.string().optional().allow(''),
  /** Auth for widget-only testing endpoints (returns an embeddable botId). */
  [ENV_CHAT_WIDGET_API_KEY]: Joi.string().min(16).optional().allow(''),
  [ENV_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE]: Joi.number().integer().min(0).optional(),
});
