import {
  WORKSPACE_BOT_ACCESS_DENIED_CODE,
  WORKSPACE_BOT_ACCESS_DENIED_MESSAGE,
  WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE,
  WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
  isWorkspaceBotAccessDenied,
  isWorkspaceBotPreviewAccessDenied,
} from './botsListMessages';

/** Resolve user-facing chat/playground error text from API failures. */
export function resolveChatRuntimeErrorMessage(result: {
  ok: boolean;
  error?: string;
  errorCode?: string;
}): string {
  if (isWorkspaceBotPreviewAccessDenied(result)) {
    return result.error?.trim() || WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE;
  }
  if (isWorkspaceBotAccessDenied(result)) {
    return result.error?.trim() || WORKSPACE_BOT_ACCESS_DENIED_MESSAGE;
  }
  if (typeof result.error === 'string' && result.error.trim()) {
    return result.error.trim();
  }
  if (result.errorCode === WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE) {
    return WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE;
  }
  if (result.errorCode === WORKSPACE_BOT_ACCESS_DENIED_CODE) {
    return WORKSPACE_BOT_ACCESS_DENIED_MESSAGE;
  }
  return 'Something went wrong. Please try again.';
}
