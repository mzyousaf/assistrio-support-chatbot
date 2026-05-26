import {
  WORKSPACE_BOT_ACCESS_DENIED_CODE,
  WORKSPACE_BOT_ACCESS_DENIED_MESSAGE,
  WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE,
  WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
  isWorkspaceBotAccessDenied,
  isWorkspaceBotPreviewAccessDenied,
} from './botsListMessages';

export const PLAN_LIMIT_AI_CREDITS_CODE = 'plan_limit_ai_credits' as const;
export const PLAN_LIMIT_AI_CREDITS_MESSAGE =
  'This workspace has used all AI credits for this billing period. Please upgrade your plan or wait until credits reset.';

export const AI_CREDITS_USAGE_UNAVAILABLE_CODE = 'ai_credits_usage_unavailable' as const;
export const AI_CREDITS_USAGE_UNAVAILABLE_MESSAGE =
  "We couldn't verify AI credit usage right now. Please try again shortly.";

/** Resolve user-facing chat/playground error text from API failures. */
export function resolveChatRuntimeErrorMessage(result: {
  ok: boolean;
  error?: string;
  errorCode?: string;
}): string {
  const code = typeof result.errorCode === 'string' ? result.errorCode.trim() : '';

  if (code === PLAN_LIMIT_AI_CREDITS_CODE) {
    return PLAN_LIMIT_AI_CREDITS_MESSAGE;
  }
  if (code === AI_CREDITS_USAGE_UNAVAILABLE_CODE) {
    return AI_CREDITS_USAGE_UNAVAILABLE_MESSAGE;
  }

  if (isWorkspaceBotPreviewAccessDenied(result)) {
    return result.error?.trim() || WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE;
  }
  if (isWorkspaceBotAccessDenied(result)) {
    return result.error?.trim() || WORKSPACE_BOT_ACCESS_DENIED_MESSAGE;
  }

  if (typeof result.error === 'string' && result.error.trim()) {
    return result.error.trim();
  }
  if (code === WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE) {
    return WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE;
  }
  if (code === WORKSPACE_BOT_ACCESS_DENIED_CODE) {
    return WORKSPACE_BOT_ACCESS_DENIED_MESSAGE;
  }
  return 'Something went wrong. Please try again.';
}
