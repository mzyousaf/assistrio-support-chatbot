import type { RuntimeAccessValidationResult } from './runtime-bot-access.util';

export type RuntimeErrorCode =
  | 'BOT_NOT_PUBLISHED'
  | 'INVALID_ACCESS_KEY'
  | 'INVALID_SECRET_KEY'
  | 'VISITOR_ID_REQUIRED'
  | 'MESSAGE_LIMIT_REACHED';

export function toRuntimeCredentialErrorCode(
  result: Extract<RuntimeAccessValidationResult, { ok: false }>,
): RuntimeErrorCode {
  if (result.reason === 'invalid_secret_key' || result.reason === 'missing_secret_key') {
    return 'INVALID_SECRET_KEY';
  }
  if (result.reason === 'unpublished') {
    return 'BOT_NOT_PUBLISHED';
  }
  return 'INVALID_ACCESS_KEY';
}

