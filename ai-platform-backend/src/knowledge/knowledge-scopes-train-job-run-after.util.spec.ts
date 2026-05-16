import { latestQueuedKnowledgeItemRunAfter } from './knowledge-scopes-train-job-run-after.util';

describe('latestQueuedKnowledgeItemRunAfter', () => {
  const now = new Date('2026-01-15T12:00:00.000Z');

  it('returns null for an empty list', () => {
    expect(latestQueuedKnowledgeItemRunAfter([], now)).toBeNull();
  });

  it('returns the max runAfter when all rows have dates', () => {
    const t1 = new Date('2026-01-15T12:00:30.000Z');
    const t2 = new Date('2026-01-15T12:05:00.000Z');
    const t3 = new Date('2026-01-15T12:01:00.000Z');
    expect(
      latestQueuedKnowledgeItemRunAfter([{ runAfter: t1 }, { runAfter: t2 }, { runAfter: t3 }], now),
    ).toEqual(t2);
  });

  it('treats missing or null runAfter as `now` (already eligible)', () => {
    const later = new Date('2026-01-15T12:02:00.000Z');
    expect(latestQueuedKnowledgeItemRunAfter([{ runAfter: null }, { runAfter: later }], now)).toEqual(later);
    expect(latestQueuedKnowledgeItemRunAfter([{}, { runAfter: later }], now)).toEqual(later);
  });

  it('when every row lacks runAfter, returns `now`', () => {
    expect(latestQueuedKnowledgeItemRunAfter([{ runAfter: null }, {}], now)).toEqual(now);
  });
});
