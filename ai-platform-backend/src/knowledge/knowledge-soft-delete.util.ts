/**
 * Live KnowledgeBaseItem rows for stats and training UX are **active** (`active !== false`).
 * See `knowledgeItemNotDeletedClause()` in `knowledge-base-item-access.service.ts`.
 */
export function knowledgeBaseItemCountsTowardStats(active: unknown): boolean {
  return active !== false;
}
