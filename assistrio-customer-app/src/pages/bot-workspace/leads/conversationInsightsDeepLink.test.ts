import { describe, expect, it } from 'vitest';
import { customerConversationInsightsPath } from './conversationInsightsDeepLink';

describe('conversationInsightsDeepLink', () => {
  it('includes conversationId and optional messageId', () => {
    expect(customerConversationInsightsPath('bot-1', 'conv-2')).toBe(
      '/bots/bot-1/insights/conversations?conversationId=conv-2',
    );
    expect(customerConversationInsightsPath('bot-1', 'conv-2', 'msg-99')).toBe(
      '/bots/bot-1/insights/conversations?conversationId=conv-2&messageId=msg-99',
    );
  });
});
