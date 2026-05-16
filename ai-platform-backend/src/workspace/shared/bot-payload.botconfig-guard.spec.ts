import { normalizeBotPayload, normalizeWorkspaceBotPatch } from './bot-payload';

describe('bot-payload botConfig guard (customer/workspace API)', () => {
  it('normalizeWorkspaceBotPatch does not accept botConfig / knowledgeSize from body', () => {
    const patch = normalizeWorkspaceBotPatch({
      name: 'Updated',
      botConfig: {
        knowledgeSize: {
          type: 'custom',
          baseMaxBytes: 1,
          extraMaxBytes: 2,
          maxBytes: 3,
        },
      },
    } as Record<string, unknown>);
    expect(patch.touched.has('botConfig')).toBe(false);
    expect(patch).not.toHaveProperty('botConfig');
    expect(patch.name).toBe('Updated');
  });

  it('normalizeBotPayload does not surface botConfig', () => {
    const n = normalizeBotPayload({
      name: 'N',
      categories: [],
      includeNotesInKnowledge: true,
      botConfig: {
        knowledgeSize: { maxBytes: 999999999 },
      },
    } as Record<string, unknown>);
    expect(n).not.toHaveProperty('botConfig');
  });

  it('normalizeWorkspaceBotPatch accepts and normalizes knowledgeReplyPriority', () => {
    const patch = normalizeWorkspaceBotPatch({
      knowledgeReplyPriority: {
        mode: 'priority',
        sourceOrder: ['faq', 'faq', 'document'],
      },
    } as Record<string, unknown>);
    expect(patch.touched.has('knowledgeReplyPriority')).toBe(true);
    expect(patch.knowledgeReplyPriority).toEqual({
      mode: 'priority',
      sourceOrder: ['faq', 'document', 'note', 'table', 'suggestion'],
    });
  });
});
