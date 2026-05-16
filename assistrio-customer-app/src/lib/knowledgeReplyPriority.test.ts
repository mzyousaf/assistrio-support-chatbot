import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KNOWLEDGE_REPLY_PRIORITY,
  movePrioritySource,
  normalizeKnowledgeReplyPriority,
} from './knowledgeReplyPriority';

describe('knowledgeReplyPriority', () => {
  it('normalizes missing settings to defaults', () => {
    expect(normalizeKnowledgeReplyPriority(undefined)).toEqual(DEFAULT_KNOWLEDGE_REPLY_PRIORITY);
  });

  it('normalizes invalid and duplicate source values', () => {
    expect(
      normalizeKnowledgeReplyPriority({
        mode: 'priority',
        sourceOrder: ['faq', 'faq', 'document'] as never,
      }),
    ).toEqual({
      mode: 'priority',
      sourceOrder: ['faq', 'document', 'note', 'table', 'suggestion'],
    });
  });

  it('keeps custom order even when mode is default', () => {
    expect(
      normalizeKnowledgeReplyPriority({
        mode: 'default',
        sourceOrder: ['suggestion', 'document', 'table', 'note', 'faq'],
      }),
    ).toEqual({
      mode: 'default',
      sourceOrder: ['suggestion', 'document', 'table', 'note', 'faq'],
    });
  });

  it('moves source order up/down safely', () => {
    const moved = movePrioritySource(['faq', 'note', 'table', 'document', 'suggestion'], 1, 1);
    expect(moved).toEqual(['faq', 'table', 'note', 'document', 'suggestion']);
    expect(movePrioritySource(moved, 0, -1)).toEqual(moved);
  });
});
