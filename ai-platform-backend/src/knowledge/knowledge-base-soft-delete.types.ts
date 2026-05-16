/**
 * Result of {@link KnowledgeBaseItemService.softDeleteKnowledgeItemsWithStats} (user-initiated KB delete).
 */
export type KnowledgeBaseSoftDeleteResult = {
  /** Distinct `_id` values matched as live rows (`knowledgeItemNotDeletedClause` + caller `match`). */
  matchedLiveCount: number;
  /** Rows updated to soft-deleted (`modifiedCount` from `updateMany`). */
  softDeletedCount: number;
  /** `KnowledgeBaseChunk` `deleteMany` `deletedCount` (may include 0 for items that had no chunks). */
  chunksRemovedCount: number;
  /** `ExtractJob` rows removed (`status === 'queued'` only; processing rows are left for workers). */
  extractJobsQueuedRemovedCount: number;
  /** Document `TrainJob` rows removed (`status === 'queued'` only). */
  documentTrainJobsQueuedRemovedCount: number;
  /** `TableImportJob` live rows marked `failed` with `errorCode: 'kb_item_deleted'`. */
  tableImportJobsMarkedFailedCount: number;
};
