import { mergeTrainingScopes, isScheduledRunDue } from './merge-training-scopes.util';

describe('mergeTrainingScopes', () => {
  it('returns faq → note → table → suggestion order and dedupes', () => {
    expect(mergeTrainingScopes(['table', 'faq'])).toEqual(['faq', 'table']);
    expect(mergeTrainingScopes(['note', 'faq', 'table'])).toEqual(['faq', 'note', 'table']);
    expect(mergeTrainingScopes(['faq', 'faq', 'note'])).toEqual(['faq', 'note']);
    expect(mergeTrainingScopes(['suggestion', 'faq', 'table'])).toEqual(['faq', 'table', 'suggestion']);
    expect(mergeTrainingScopes(['suggestion', 'note', 'table', 'faq'])).toEqual(['faq', 'note', 'table', 'suggestion']);
  });

  it('ignores invalid scope strings', () => {
    expect(mergeTrainingScopes(['faq', 'not_a_scope' as unknown as 'faq', 'table'])).toEqual(['faq', 'table']);
  });
});

describe('isScheduledRunDue', () => {
  it('treats missing, undefined, and null as due', () => {
    const now = new Date('2026-01-15T12:00:00.000Z');
    expect(isScheduledRunDue(undefined, now)).toBe(true);
    expect(isScheduledRunDue(null as unknown as Date, now)).toBe(true);
  });

  it('is due when runAfter is in the past or equal to now', () => {
    const now = new Date('2026-01-15T12:00:00.000Z');
    expect(isScheduledRunDue(new Date('2026-01-15T11:00:00.000Z'), now)).toBe(true);
    expect(isScheduledRunDue(new Date('2026-01-15T12:00:00.000Z'), now)).toBe(true);
  });

  it('is not due when runAfter is in the future', () => {
    const now = new Date('2026-01-15T12:00:00.000Z');
    expect(isScheduledRunDue(new Date('2026-01-15T12:00:01.000Z'), now)).toBe(false);
  });
});
