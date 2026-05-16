/**
 * Public/embed conversation message read projection — must stay minimal (no billing, RAG internals, or analytics-only fields).
 */
export const EMBED_CONVERSATION_MESSAGE_FIELD_KEYS = [
  'role',
  'content',
  'createdAt',
  'speechInput',
  'attachments',
  /** Visitor’s own thumbs on assistant rows — safe to echo back into embed/history UIs. */
  'feedback',
] as const;

export const EMBED_CONVERSATION_MESSAGE_PROJECT = Object.fromEntries(
  EMBED_CONVERSATION_MESSAGE_FIELD_KEYS.map((k) => [k, 1]),
) as Record<(typeof EMBED_CONVERSATION_MESSAGE_FIELD_KEYS)[number], 1>;
