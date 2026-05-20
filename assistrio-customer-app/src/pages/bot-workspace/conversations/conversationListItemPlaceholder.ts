import type { CustomerConversationListItem } from '@/api/types';

/**
 * Minimal list row when opening `/insights/conversations?conversationId=…` before the
 * conversation appears in the current loaded page of results.
 */
export function conversationListItemPlaceholder(conversationId: string): CustomerConversationListItem {
  return {
    id: conversationId,
    conversationId,
    chatVisitorId: '—',
    userPreview: '',
    assistantPreview: '',
    startedAt: null,
    firstUserMessageAt: null,
    lastUserMessageAt: null,
    lastAssistantMessageAt: null,
    lastMessageAt: null,
    lastActivityAt: '',
    createdAt: null,
    startedFrom: null,
    sessionSource: null,
    conversationOrigin: null,
    location: null,
    deviceInfo: null,
    totalUserMessages: 0,
    totalAssistantMessages: 0,
    totalMessages: 0,
    textMessageCount: 0,
    voiceMessageCount: 0,
    dictationMessageCount: 0,
    attachmentMessageCount: 0,
    suggestedQuestionMessageCount: 0,
    totalCreditsUsed: 0,
    sourcesUsedCount: 0,
    hasLead: false,
    hasVoice: false,
    hasDictation: false,
    hasAttachment: false,
    status: 'open',
  };
}
