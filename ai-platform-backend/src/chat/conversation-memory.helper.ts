/**
 * Builds model-ready conversation context with a scalable memory strategy.
 * Keeps the current user message out of history so it is not duplicated in the prompt.
 */

export interface ConversationMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Output: messages to include in prompt (excludes current user message); optional summary for long convos. */
export interface ModelConversationContext {
  messages: ConversationMessageInput[];
  /** Placeholder for future summarization; empty for now. */
  summary: string;
}

/** Default: include last 14 messages when conversation is long. */
const DEFAULT_RECENT_WINDOW = 14;

/**
 * Build conversation context for the LLM prompt.
 * - History MUST NOT include the current user message (it is passed separately as "current user message").
 * - Short conversation: include full history; optional storedSummary if set.
 * - Long conversation: include storedSummary (if any) + last N messages.
 * Summary-ready: pass storedSummary from conversation.summary when available.
 */
export function buildModelConversationContext(
  allMessages: ConversationMessageInput[],
  currentUserMessage: string,
  options?: { recentWindow?: number; storedSummary?: string },
): ModelConversationContext {
  const windowSize = options?.recentWindow ?? DEFAULT_RECENT_WINDOW;
  const storedSummary = (options?.storedSummary || '').trim();

  const trimmed = trimToHistoryOnly(allMessages, currentUserMessage);

  if (trimmed.length <= windowSize) {
    return { messages: trimmed, summary: storedSummary };
  }

  const recent = trimmed.slice(-windowSize);
  return { messages: recent, summary: storedSummary };
}

/**
 * Remove the current user message from the end of the list if it matches.
 * This ensures "Conversation history" does not repeat the same content as "Current user message".
 */
function trimToHistoryOnly(
  messages: ConversationMessageInput[],
  currentUserMessage: string,
): ConversationMessageInput[] {
  const current = (currentUserMessage || '').trim();
  if (!current || messages.length === 0) return messages;

  const last = messages[messages.length - 1];
  if (last.role === 'user' && (last.content || '').trim() === current) {
    return messages.slice(0, -1);
  }
  return messages;
}
