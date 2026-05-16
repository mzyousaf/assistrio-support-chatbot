import { EMBED_CONVERSATION_MESSAGE_FIELD_KEYS } from './embed-conversation-message-fields.constant';

describe('EMBED_CONVERSATION_MESSAGE_FIELD_KEYS', () => {
  it('allows visitor-visible assistant feedback but not billing or RAG internals', () => {
    const keys = new Set<string>(EMBED_CONVERSATION_MESSAGE_FIELD_KEYS);
    expect(keys.has('feedback')).toBe(true);
    expect(keys.has('creditCost')).toBe(false);
    expect(keys.has('aiMeta')).toBe(false);
    expect(keys.has('sources')).toBe(false);
    expect(keys.has('voiceMeta')).toBe(false);
    expect(keys.has('inputType')).toBe(false);
    expect(keys.has('topics')).toBe(false);
    expect(keys.has('sentiment')).toBe(false);
  });
});
