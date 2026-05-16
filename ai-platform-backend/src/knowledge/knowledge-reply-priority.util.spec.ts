import {
  DEFAULT_KNOWLEDGE_REPLY_PRIORITY_SETTINGS,
  normalizeKnowledgeReplyPrioritySettings,
} from './knowledge-reply-priority.util';

describe('knowledge-reply-priority.util', () => {
  it('uses default mode/order when input is missing', () => {
    expect(normalizeKnowledgeReplyPrioritySettings(undefined)).toEqual(
      DEFAULT_KNOWLEDGE_REPLY_PRIORITY_SETTINGS,
    );
  });

  it('normalizes invalid and partial sourceOrder entries', () => {
    const out = normalizeKnowledgeReplyPrioritySettings({
      mode: 'priority',
      sourceOrder: ['faq', 'faq', 'invalid', 'document'],
    });
    expect(out.mode).toBe('priority');
    expect(out.sourceOrder).toEqual(['faq', 'document', 'note', 'table', 'suggestion']);
  });
});
