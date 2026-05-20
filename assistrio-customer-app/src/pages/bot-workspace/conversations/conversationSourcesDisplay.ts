import type { CustomerConversationMessageSource } from '@/api/types';
import { sortSourcesByMatchScoreDesc } from './conversationTopSource';

/** Inline list under assistant messages; modal shows all prompt-used sources. */
export const INLINE_SOURCES_LIMIT = 3;

export function sourcesForDisplay(
  sources: CustomerConversationMessageSource[] | null | undefined,
): CustomerConversationMessageSource[] {
  const list = sources?.filter(Boolean) ?? [];
  return list.length ? sortSourcesByMatchScoreDesc(list) : [];
}

export function inlineSources(
  sorted: CustomerConversationMessageSource[],
): CustomerConversationMessageSource[] {
  return sorted.slice(0, INLINE_SOURCES_LIMIT);
}
