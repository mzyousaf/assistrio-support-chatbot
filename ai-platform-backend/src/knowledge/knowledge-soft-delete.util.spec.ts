import { knowledgeBaseItemCountsTowardStats } from './knowledge-soft-delete.util';

/**
 * Contract: stats use rows counted as live (`active !== false`); see {@link knowledgeItemNotDeletedClause}
 * for the same predicate in aggregations and pending-items.
 */
describe('knowledgeBaseItemCountsTowardStats', () => {
  it('excludes deactivated rows (overview stats, lifecycle counts, pending-items)', () => {
    expect(knowledgeBaseItemCountsTowardStats(false)).toBe(false);
  });

  it('includes active rows and legacy documents without an explicit active field', () => {
    expect(knowledgeBaseItemCountsTowardStats(true)).toBe(true);
    expect(knowledgeBaseItemCountsTowardStats(undefined)).toBe(true);
  });
});
