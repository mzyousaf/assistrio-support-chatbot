import type { CustomerConversationMessage } from '@/api/types';
import { prepareChatMessagePlainText } from '@acw/lib/chatMessageDisplay.util';

export function conversationMessageBodyText(m: CustomerConversationMessage): string {
  const c = m.content?.trim();
  const raw = c ? m.content! : (m.text ?? '');
  return prepareChatMessagePlainText(raw);
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
