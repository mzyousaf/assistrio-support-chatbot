import { sortOnboardingKbItemsLatestFirst } from './workspace-onboarding-knowledge-sort.util';

describe('sortOnboardingKbItemsLatestFirst', () => {
  it('sorts by updatedAt descending, then createdAt when updatedAt is missing', () => {
    const sorted = sortOnboardingKbItemsLatestFirst([
      { id: 'a', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z' },
      { id: 'b', createdAt: '2024-01-05T00:00:00.000Z', updatedAt: null },
      { id: 'c', createdAt: '2024-01-03T00:00:00.000Z', updatedAt: '2024-01-04T00:00:00.000Z' },
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['c', 'a', 'b']);
  });

  it('falls back to id when timestamps tie', () => {
    const sorted = sortOnboardingKbItemsLatestFirst([
      { id: 'alpha', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: null },
      { id: 'beta', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: null },
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['beta', 'alpha']);
  });

  it('prefers updatedAt over older createdAt when both exist', () => {
    const sorted = sortOnboardingKbItemsLatestFirst([
      { id: 'old-edit', createdAt: '2024-01-10T00:00:00.000Z', updatedAt: '2024-01-15T00:00:00.000Z' },
      { id: 'newer-create', createdAt: '2024-01-12T00:00:00.000Z', updatedAt: null },
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['old-edit', 'newer-create']);
  });

  it('uses createdAt when updatedAt is missing', () => {
    const sorted = sortOnboardingKbItemsLatestFirst([
      { id: 'a', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: null },
      { id: 'b', createdAt: '2024-01-05T00:00:00.000Z', updatedAt: null },
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('prefers updateSequence over updatedAt', () => {
    const sorted = sortOnboardingKbItemsLatestFirst([
      {
        id: 'a',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        updateSequence: 100,
      },
      {
        id: 'b',
        createdAt: '2024-01-10T00:00:00.000Z',
        updatedAt: '2024-01-10T00:00:00.000Z',
        updateSequence: 50,
      },
    ]);
    expect(sorted.map((row) => row.id)).toEqual(['a', 'b']);
  });
});
