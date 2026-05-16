import { describe, expect, it } from 'vitest';
import type { CustomerKnowledgeStatusItem } from '@/api/types';
import { mergeQaRowsWithKbStatusPoll } from './knowledgeViewTypes';

describe('mergeQaRowsWithKbStatusPoll — active from poll', () => {
  it('applies active:false from lightweight status row', () => {
    const base = [
      {
        title: 'T',
        questions: ['Q'],
        answer: 'A',
        active: true,
        faqIndex: 0,
        knowledgeItemId: 'kid1',
        trainingStatus: 'ready' as const,
      },
    ];
    const poll = [
      {
        id: 'kid1',
        status: 'ready',
        active: false,
        displayStatus: 'ready',
        displayLabel: 'Trained',
        displayMessage: '',
        faqIndex: 0,
      },
    ] as unknown as CustomerKnowledgeStatusItem[];
    const out = mergeQaRowsWithKbStatusPoll(base, poll);
    expect(out[0]!.active).toBe(false);
  });

  it('trusts poll ready over stale bot pending when Use in replies is off', () => {
    const base = [
      {
        title: 'T',
        questions: ['Q'],
        answer: 'A',
        active: false,
        faqIndex: 0,
        knowledgeItemId: 'kid1',
        trainingStatus: 'pending' as const,
      },
    ];
    const poll = [
      {
        id: 'kid1',
        status: 'ready',
        active: false,
        displayStatus: 'ready',
        displayLabel: 'Trained',
        displayMessage: '',
        faqIndex: 0,
      },
    ] as unknown as CustomerKnowledgeStatusItem[];
    const out = mergeQaRowsWithKbStatusPoll(base, poll);
    expect(out[0]!.trainingStatus).toBe('ready');
  });
});
