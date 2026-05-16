import { describe, expect, it } from 'vitest';
import type { CustomerKnowledgeStatusItem } from '@/api/types';
import { mergeDocumentRowsWithKbStatusPoll, type DocumentRowWithKbMeta } from './knowledgeViewTypes';

describe('mergeDocumentRowsWithKbStatusPoll', () => {
  it('sets runAfter to null when poll row has null runAfter (clears stale)', () => {
    const base: DocumentRowWithKbMeta[] = [
      {
        _id: 'kb-1',
        knowledgeItemId: 'kb-1',
        title: 'Doc',
        trainingStatus: 'queued',
        runAfter: '2026-01-01T00:00:00.000Z',
      },
    ];
    const poll: CustomerKnowledgeStatusItem[] = [
      {
        id: 'kb-1',
        sourceType: 'document',
        status: 'queued',
        runAfter: null,
        displayStatus: 'training_queued',
        displayLabel: 'Queued',
        displayMessage: '',
      } as CustomerKnowledgeStatusItem,
    ];
    const merged = mergeDocumentRowsWithKbStatusPoll(base, poll, (row) => String(row._id ?? ''), () => false);
    expect(merged[0]?.runAfter).toBeNull();
  });

  it('keeps inactive document rows visible when status poll does not include them', () => {
    const base: DocumentRowWithKbMeta[] = [
      {
        _id: 'doc-1',
        knowledgeItemId: 'kb-1',
        title: 'Inactive doc',
        active: false,
        trainingStatus: 'ready',
      },
    ];

    const merged = mergeDocumentRowsWithKbStatusPoll(
      base,
      [],
      (row) => String(row._id ?? ''),
      () => false,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.active).toBe(false);
    expect(merged[0]?._id).toBe('doc-1');
  });
});
