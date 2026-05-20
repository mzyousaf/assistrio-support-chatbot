/**
 * Simple greeting/thanks messages that skip RAG and OpenAI completion.
 */

import { classifyQuestion } from './answerability.helper';

const BLOCKED_FAST_PATH =
  /\b(what|how|where|when|why|which|who|price|pricing|feature|features|support|assist|help\s+me|tell\s+me)\b/i;

const SIMPLE_GREETING_RE =
  /^(hi|hello|hey|howdy|greetings)([\s!.?,]*)$/i;

const SIMPLE_THANKS_RE =
  /^(thanks?|thank\s+you|ty)([\s!.?,]*)$/i;

export const GREETING_FAST_PATH_HELLO_REPLY = 'Hi! How can I help you today?';
export const GREETING_FAST_PATH_THANKS_REPLY =
  "You're welcome! Let me know if you need anything else.";

/**
 * True for short greetings/thanks only — skips RAG and OpenAI when safe.
 */
export function isSimpleGreetingFastPathMessage(message: string): boolean {
  const q = (message ?? '').trim();
  if (!q || q.length > 60) return false;
  if (/\?/.test(q)) return false;
  if (BLOCKED_FAST_PATH.test(q)) return false;
  if (!SIMPLE_GREETING_RE.test(q) && !SIMPLE_THANKS_RE.test(q)) return false;
  return classifyQuestion(q) === 'greeting_small_talk';
}

export function isGreetingFastPathThanksMessage(message: string): boolean {
  const q = (message ?? '').trim();
  return SIMPLE_THANKS_RE.test(q);
}

/** Deterministic assistant reply for greeting fast path (no OpenAI). */
export function resolveGreetingFastPathReply(message: string): string {
  if (isGreetingFastPathThanksMessage(message)) {
    return GREETING_FAST_PATH_THANKS_REPLY;
  }
  return GREETING_FAST_PATH_HELLO_REPLY;
}
