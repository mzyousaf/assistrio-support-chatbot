import type { CustomerConversationMessage } from '@/api/types';

export function conversationMessageBodyText(m: CustomerConversationMessage): string {
  const c = m.content?.trim();
  if (c) return m.content;
  return m.text ?? '';
}

/** Nearest preceding message with role `user` (for FAQ question prefill). */
export function nearestPreviousUserMessageText(
  messages: CustomerConversationMessage[],
  assistantIndex: number,
): string | null {
  for (let i = assistantIndex - 1; i >= 0; i--) {
    const row = messages[i];
    if (!row) continue;
    const r = (row.role ?? '').toLowerCase();
    if (r !== 'user') continue;
    const t = conversationMessageBodyText(row).trim();
    return t || null;
  }
  return null;
}
