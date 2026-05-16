import { describe, expect, it } from 'vitest';
import type { CustomerKnowledgeStatusItem } from '@/api/types';
import { mergeExampleQuestionsWithKbStatusPoll, type ExampleQuestionItem } from './exampleQuestionHelpers';

describe('mergeExampleQuestionsWithKbStatusPoll runAfter', () => {
  const base: ExampleQuestionItem[] = [
    {
      label: 'Chip',
      context: 'scope',
      suggestionIndex: 0,
      knowledgeItemId: 'kid-s',
      trainingStatus: 'queued',
      runAfter: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('clears stale runAfter when poll sends null', () => {
    const poll: CustomerKnowledgeStatusItem[] = [
      {
        id: 'kid-s',
        status: 'ready',
        sourceType: 'suggestion',
        suggestionIndex: 0,
        displayStatus: 'ready',
        displayLabel: 'Trained',
        displayMessage: '',
        runAfter: null,
      } as CustomerKnowledgeStatusItem,
    ];
    const merged = mergeExampleQuestionsWithKbStatusPoll(base, poll);
    expect(merged[0]?.runAfter).toBeNull();
  });

  it('applies runAfter from poll', () => {
    const iso = '2026-06-01T08:00:00.000Z';
    const poll: CustomerKnowledgeStatusItem[] = [
      {
        id: 'kid-s',
        status: 'queued',
        sourceType: 'suggestion',
        suggestionIndex: 0,
        displayStatus: 'training_queued',
        displayLabel: 'Training Queued',
        displayMessage: '',
        runAfter: iso,
      } as CustomerKnowledgeStatusItem,
    ];
    const merged = mergeExampleQuestionsWithKbStatusPoll(base, poll);
    expect(merged[0]?.runAfter).toBe(iso);
  });
});
