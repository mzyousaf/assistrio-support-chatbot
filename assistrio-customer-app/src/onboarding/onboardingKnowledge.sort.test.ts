import { describe, expect, it } from 'vitest';
import {
  onboardingKbItemsSortFingerprint,
  sortedOnboardingQas,
  sortedOnboardingSnippets,
  sortedStagedDocumentItemsFromOnboarding,
  stagedDatasheetsFromOnboarding,
} from './onboardingKnowledge';

describe('onboardingKnowledge sorting helpers', () => {
  it('sorts staged documents newest first', () => {
    const sorted = sortedStagedDocumentItemsFromOnboarding({
      documents: [
        { id: 'd1', sourceType: 'document', originalName: 'old.pdf', mimeType: '', sizeBytes: 1, status: 'uploaded', createdAt: '2024-01-01T00:00:00.000Z' },
        { id: 'd2', sourceType: 'document', originalName: 'new.pdf', mimeType: '', sizeBytes: 1, status: 'uploaded', createdAt: '2024-01-05T00:00:00.000Z' },
      ],
      datasheets: [],
    });
    expect(sorted.map((row) => row.id)).toEqual(['d2', 'd1']);
  });

  it('sorts datasheets newest first', () => {
    const sorted = stagedDatasheetsFromOnboarding({
      documents: [],
      datasheets: [
        { id: 's1', sourceType: 'datasheet', originalName: 'a.csv', mimeType: '', sizeBytes: 1, status: 'uploaded', createdAt: '2024-01-01T00:00:00.000Z' },
        { id: 's2', sourceType: 'datasheet', originalName: 'b.csv', mimeType: '', sizeBytes: 1, status: 'uploaded', createdAt: '2024-01-04T00:00:00.000Z' },
      ],
    });
    expect(sorted.map((row) => row.id)).toEqual(['s2', 's1']);
  });

  it('sorts snippets C/B/A by createdAt without mutating source array', () => {
    const source = [
      { id: 'a', title: 'A', description: 'A', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
      { id: 'b', title: 'B', description: 'B', createdAt: '2024-01-02T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z' },
      { id: 'c', title: 'C', description: 'C', createdAt: '2024-01-03T00:00:00.000Z', updatedAt: '2024-01-03T00:00:00.000Z' },
    ];
    const sorted = sortedOnboardingSnippets(source);
    expect(sorted.map((row) => row.id)).toEqual(['c', 'b', 'a']);
    expect(source.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts snippets A/C/B after editing A', () => {
    const source = [
      { id: 'a', title: 'A', description: 'A', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-04T00:00:00.000Z' },
      { id: 'b', title: 'B', description: 'B', createdAt: '2024-01-02T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z' },
      { id: 'c', title: 'C', description: 'C', createdAt: '2024-01-03T00:00:00.000Z', updatedAt: '2024-01-03T00:00:00.000Z' },
    ];
    expect(sortedOnboardingSnippets(source).map((row) => row.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts Q&A C/B/A then A/C/B after editing A', () => {
    const created = [
      { id: 'a', title: 'A', questions: ['?'], answer: 'A', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
      { id: 'b', title: 'B', questions: ['?'], answer: 'B', createdAt: '2024-01-02T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z' },
      { id: 'c', title: 'C', questions: ['?'], answer: 'C', createdAt: '2024-01-03T00:00:00.000Z', updatedAt: '2024-01-03T00:00:00.000Z' },
    ];
    expect(sortedOnboardingQas(created).map((row) => row.id)).toEqual(['c', 'b', 'a']);

    const edited = [
      { ...created[0]!, updatedAt: '2024-01-04T00:00:00.000Z', updateSequence: 4 },
      created[1]!,
      created[2]!,
    ];
    expect(sortedOnboardingQas(edited).map((row) => row.id)).toEqual(['a', 'c', 'b']);
  });

  it('builds sort fingerprint that changes when updatedAt changes', () => {
    const before = onboardingKbItemsSortFingerprint([
      { id: 'a', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
    ]);
    const after = onboardingKbItemsSortFingerprint([
      { id: 'a', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-04T00:00:00.000Z' },
    ]);
    expect(before).not.toBe(after);
  });
});
