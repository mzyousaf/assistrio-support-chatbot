import { describe, expect, it } from 'vitest';
import { sortOnboardingKbItemsLatestFirst } from './sortOnboardingKbItems';

describe('sortOnboardingKbItemsLatestFirst', () => {
  it('sorts by updatedAt descending before createdAt fallback', () => {
    const sorted = sortOnboardingKbItemsLatestFirst([
      { id: 'a', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z' },
      { id: 'b', createdAt: '2024-01-05T00:00:00.000Z', updatedAt: null },
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('prefers updateSequence over timestamps', () => {
    const sorted = sortOnboardingKbItemsLatestFirst([
      {
        id: 'old-edit',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        sequence: 1,
        updateSequence: 99,
      },
      {
        id: 'new-create',
        createdAt: '2024-01-10T00:00:00.000Z',
        updatedAt: '2024-01-10T00:00:00.000Z',
        sequence: 50,
        updateSequence: 50,
      },
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['old-edit', 'new-create']);
  });

  it('sorts C/B/A then A/C/B after edit', () => {
    const created = sortOnboardingKbItemsLatestFirst([
      { id: 'a', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z', sequence: 1, updateSequence: 1 },
      { id: 'b', createdAt: '2024-01-02T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z', sequence: 2, updateSequence: 2 },
      { id: 'c', createdAt: '2024-01-03T00:00:00.000Z', updatedAt: '2024-01-03T00:00:00.000Z', sequence: 3, updateSequence: 3 },
    ]);
    expect(created.map((row) => row.id)).toEqual(['c', 'b', 'a']);

    const edited = sortOnboardingKbItemsLatestFirst([
      { id: 'a', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-04T00:00:00.000Z', sequence: 1, updateSequence: 99 },
      { id: 'b', createdAt: '2024-01-02T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z', sequence: 2, updateSequence: 2 },
      { id: 'c', createdAt: '2024-01-03T00:00:00.000Z', updatedAt: '2024-01-03T00:00:00.000Z', sequence: 3, updateSequence: 3 },
    ]);
    expect(edited.map((row) => row.id)).toEqual(['a', 'c', 'b']);
  });
});
