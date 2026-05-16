import { describe, expect, it } from 'vitest';
import type { CustomerKnowledgeStatusItem } from '@/api/types';
import {
  kbPollRunAfterIso,
  mergeQaRowsWithKbStatusPoll,
  mergeSnippetRowsWithKbStatusPoll,
  mergeTableRowsWithKbStatusPoll,
  type QaRow,
  type SnippetRow,
  type TableBlock,
} from './knowledgeViewTypes';

function pollFaq(overrides: Partial<CustomerKnowledgeStatusItem>): CustomerKnowledgeStatusItem {
  return {
    id: 'kid-1',
    status: 'queued',
    displayStatus: 'training_queued',
    displayLabel: 'Training Queued',
    displayMessage: '',
    ...overrides,
  } as CustomerKnowledgeStatusItem;
}

describe('kbPollRunAfterIso', () => {
  it('returns null for empty or missing runAfter', () => {
    expect(kbPollRunAfterIso(pollFaq({ runAfter: null }))).toBeNull();
    expect(kbPollRunAfterIso(pollFaq({ runAfter: undefined }))).toBeNull();
    expect(kbPollRunAfterIso(pollFaq({ runAfter: '   ' }))).toBeNull();
  });

  it('returns trimmed ISO string when set', () => {
    const iso = '2026-05-09T15:00:00.000Z';
    expect(kbPollRunAfterIso(pollFaq({ runAfter: `  ${iso} ` }))).toBe(iso);
  });
});

describe('mergeQaRowsWithKbStatusPoll runAfter', () => {
  const base: QaRow[] = [
    {
      title: 'T',
      questions: ['Q'],
      answer: 'A',
      faqIndex: 0,
      knowledgeItemId: 'kid-1',
      trainingStatus: 'queued',
      runAfter: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('clears stale runAfter when poll sends null', () => {
    const merged = mergeQaRowsWithKbStatusPoll(base, [pollFaq({ faqIndex: 0, runAfter: null })]);
    expect(merged[0]?.runAfter).toBeNull();
  });

  it('applies future runAfter from poll', () => {
    const iso = '2026-12-01T10:00:00.000Z';
    const merged = mergeQaRowsWithKbStatusPoll(base, [pollFaq({ faqIndex: 0, runAfter: iso })]);
    expect(merged[0]?.runAfter).toBe(iso);
  });
});

describe('mergeSnippetRowsWithKbStatusPoll runAfter', () => {
  const base: SnippetRow[] = [
    {
      title: 'S',
      snippet: 'body',
      snippetIndex: 0,
      knowledgeItemId: 'kid-2',
      trainingStatus: 'queued',
      runAfter: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('clears stale runAfter when poll sends null', () => {
    const merged = mergeSnippetRowsWithKbStatusPoll(base, [
      pollFaq({ id: 'kid-2', sourceType: 'note', snippetIndex: 0, runAfter: null }),
    ]);
    expect(merged[0]?.runAfter).toBeNull();
  });
});

describe('mergeTableRowsWithKbStatusPoll runAfter', () => {
  const base: TableBlock[] = [
    {
      title: 'D',
      columns: ['c'],
      rows: [['x']],
      tableIndex: 0,
      knowledgeItemId: 'kid-3',
      trainingStatus: 'queued',
      runAfter: '2026-01-01T00:00:00.000Z',
    },
  ];

  it('clears stale runAfter when poll sends null', () => {
    const merged = mergeTableRowsWithKbStatusPoll(base, [
      pollFaq({ id: 'kid-3', sourceType: 'table', tableIndex: 0, runAfter: null }),
    ]);
    expect(merged[0]?.runAfter).toBeNull();
  });
});
