import { describe, expect, it } from 'vitest';
import {
  REPLY_PRIORITY_SECTION_COPY,
  REPLY_PRIORITY_SOURCE_META,
  reorderPriorityByDrop,
} from './knowledgeReplyPrioritySection';

describe('knowledgeReplyPrioritySection', () => {
  it('exposes default and prioritized ranking copy', () => {
    expect(REPLY_PRIORITY_SECTION_COPY.defaultTitle).toBe('Default ranking');
    expect(REPLY_PRIORITY_SECTION_COPY.priorityTitle).toBe('Prioritized ranking');
    expect(REPLY_PRIORITY_SECTION_COPY.defaultModeNote).toContain('saved');
    expect(REPLY_PRIORITY_SECTION_COPY.prioritizedModeNote).toContain('Drag');
  });

  it('contains all expected source rows in product order', () => {
    expect(REPLY_PRIORITY_SOURCE_META.map((s) => s.label)).toEqual([
      'FAQ',
      'Snippet',
      'Datasheet',
      'Document',
      'Suggestion',
    ]);
  });

  it('reorders list on drag drop indices', () => {
    const out = reorderPriorityByDrop(['faq', 'note', 'table', 'document', 'suggestion'], 4, 1);
    expect(out).toEqual(['faq', 'suggestion', 'note', 'table', 'document']);
  });

  it('returns same order for invalid drag/drop indices', () => {
    const base = ['faq', 'note', 'table', 'document', 'suggestion'] as const;
    expect(reorderPriorityByDrop([...base], -1, 2)).toEqual([...base]);
    expect(reorderPriorityByDrop([...base], 0, 99)).toEqual([...base]);
    expect(reorderPriorityByDrop([...base], 2, 2)).toEqual([...base]);
  });
});
