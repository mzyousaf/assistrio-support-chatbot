import { Types } from 'mongoose';

/** `metadata.messageId` (preferred) or `metadata.assistantMessageId` (alias). */
export function extractAssistantFeedbackMessageId(meta: Record<string, unknown>): string | null {
  const primary = meta.messageId;
  const alt = meta.assistantMessageId;
  const s =
    typeof primary === 'string' && primary.trim()
      ? primary.trim()
      : typeof alt === 'string' && alt.trim()
        ? alt.trim()
        : '';
  return s || null;
}

export function normalizeAssistantFeedbackRating(value: unknown): 'up' | 'down' | null {
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (['up', 'like', 'positive', 'thumbs_up', 'thumbsup', '+1', '👍'].includes(s)) return 'up';
    if (['down', 'dislike', 'negative', 'thumbs_down', 'thumbsdown', '-1', '👎'].includes(s)) return 'down';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 1) return 'up';
    if (value === -1) return 'down';
  }
  return null;
}

export function parseOptionalObjectIdLike(input: unknown): Types.ObjectId | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  const s = input.trim();
  if (!Types.ObjectId.isValid(s)) return null;
  return new Types.ObjectId(s);
}

export function inferAssistantFeedbackSource(meta: Record<string, unknown>): 'widget' | 'preview' | 'unknown' {
  const s = typeof meta.source === 'string' ? meta.source.trim().toLowerCase() : '';
  if (s.includes('preview') || s === 'widget_preview' || s === 'playground_preview' || s === 'shared_preview') {
    return 'preview';
  }
  if (
    s.includes('widget') ||
    s.includes('runtime') ||
    s.includes('iframe') ||
    s.includes('embed') ||
    s.includes('shared') ||
    s === 'script_embed'
  ) {
    return 'widget';
  }
  return 'unknown';
}
