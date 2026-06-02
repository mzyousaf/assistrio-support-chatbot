export const PLAN_LIMIT_AI_CREDITS_CODE = "plan_limit_ai_credits" as const;
export const PLAN_LIMIT_AI_CREDITS_MESSAGE = "This agent is out of credits.";

export const AI_CREDITS_USAGE_UNAVAILABLE_CODE = "ai_credits_usage_unavailable" as const;
export const AI_CREDITS_USAGE_UNAVAILABLE_MESSAGE =
  "We couldn't verify AI credit usage right now. Please try again shortly.";

export const WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE = "workspace_bot_preview_access_denied" as const;
export const WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE =
  "You don't have permission to preview this agent. Ask a workspace owner or admin for access.";

export const WORKSPACE_BOT_LIMIT_EXCEEDED_CODE = "workspace_bot_limit_exceeded" as const;
export const WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE =
  "This agent is currently inactive. Please contact the workspace owner.";

export const PLAN_LIMIT_SHARE_PREVIEW_CODE = "plan_limit_share_preview" as const;
export const PLAN_LIMIT_SHARE_PREVIEW_MESSAGE =
  "This preview link is no longer active. Please contact the workspace owner.";

export type ChatRuntimeErrorInput = {
  error?: string;
  errorCode?: string;
  message?: string;
};

export type ResolveChatRuntimeErrorOptions = {
  visitorMultiChatMax?: number | null;
  /** Widget default when nothing else matches. */
  fallback?: string;
};

function readRawErrorText(response: ChatRuntimeErrorInput): string {
  if (typeof response.error === "string" && response.error.trim()) {
    return response.error.trim();
  }
  if (typeof response.message === "string" && response.message.trim()) {
    return response.message.trim();
  }
  return "";
}

/** User-facing chat runtime error text for embed, preview, share, and iframe surfaces. */
export function resolveChatRuntimeErrorMessage(
  response: ChatRuntimeErrorInput,
  options?: ResolveChatRuntimeErrorOptions,
): string {
  const code = typeof response.errorCode === "string" ? response.errorCode.trim() : "";

  switch (code) {
    case PLAN_LIMIT_AI_CREDITS_CODE:
      return PLAN_LIMIT_AI_CREDITS_MESSAGE;
    case AI_CREDITS_USAGE_UNAVAILABLE_CODE:
      return AI_CREDITS_USAGE_UNAVAILABLE_MESSAGE;
    case WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_CODE:
      return WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE;
    case WORKSPACE_BOT_LIMIT_EXCEEDED_CODE:
      return WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE;
    case PLAN_LIMIT_SHARE_PREVIEW_CODE:
      return PLAN_LIMIT_SHARE_PREVIEW_MESSAGE;
    case "BOT_NOT_PUBLISHED":
      return "This bot is not available for embedding right now.";
    case "INVALID_ACCESS_KEY":
    case "INVALID_SECRET_KEY":
      return "Chat access is invalid. Please verify your access key.";
    case "VISITOR_ID_REQUIRED":
      return "A visitor session is required for this bot.";
    case "MESSAGE_LIMIT_REACHED":
      return "This bot has reached its message limit.";
    case "VISITOR_MULTI_CHAT_LIMIT_REACHED": {
      const max = options?.visitorMultiChatMax;
      if (max != null && Number.isFinite(max) && max > 0) {
        return `You've reached the limit of ${max} saved conversation${max === 1 ? "" : "s"}. Open an existing thread from Recent chats or end one before starting new.`;
      }
      return "You've reached the maximum number of saved conversations.";
    }
    case "CONVERSATION_NOT_FOUND":
      return "That conversation could not be loaded.";
    case "EMBED_DOMAIN_NOT_ALLOWED":
    case "EMBED_ORIGIN_REQUIRED":
    case "EMBED_ORIGIN_INVALID":
    case "EMBED_NO_ALLOWLIST":
    case "PREVIEW_ORIGIN_NOT_ALLOWED":
      return "This chat widget is not allowed on this site.";
    default:
      break;
  }

  const raw = readRawErrorText(response);
  if (raw) return raw;

  return options?.fallback ?? "No response.";
}
