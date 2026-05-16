import {
  knowledgeBaseItemIsEffectivelyDeleted,
  knowledgeItemNotDeletedClause,
} from './knowledge-base-item-access.service';

/** Non-document KB types used in unified retrieval (extraction is `not_required` or legacy unset). */
const RUNTIME_RETRIEVAL_NON_DOCUMENT_SOURCE_TYPES = ['faq', 'note', 'table', 'suggestion', 'url', 'html'] as const;

/**
 * Mongo `$and` fragments for {@link KnowledgeBaseRetrievalService}: live row + `ready` + extraction rules.
 * Retrieval loads eligible **items first**, then chunks for those ids only; this predicate must match either way.
 */
export function knowledgeRuntimeRetrievalMatchParts(): Record<string, unknown>[] {
  return [
    knowledgeItemNotDeletedClause(),
    { status: 'ready' },
    {
      $or: [
      {
        sourceType: 'document',
        isContentExtracted: true,
        $or: [
          { extractionStatus: 'done' },
          { extractionStatus: { $exists: false } },
          { extractionStatus: null },
        ],
      },
        {
          sourceType: { $in: [...RUNTIME_RETRIEVAL_NON_DOCUMENT_SOURCE_TYPES] },
          $or: [
            { extractionStatus: 'not_required' },
            { extractionStatus: { $exists: false } },
            { extractionStatus: null },
          ],
        },
      ],
    },
  ];
}

/**
 * Defensive filter on a lean KB row (e.g. after chunk join) so stale data never becomes evidence.
 */
export function knowledgeBaseItemEligibleForRuntimeRetrieval(row: {
  active?: boolean;
  deletedAt?: Date | null;
  status?: string;
  sourceType?: string;
  extractionStatus?: string | null;
  isContentExtracted?: boolean;
}): boolean {
  if (knowledgeBaseItemIsEffectivelyDeleted(row)) return false;
  if (row.active === false) return false;
  if (row.status !== 'ready') return false;
  const st = row.sourceType;
  if (st === 'document') {
    if (row.isContentExtracted !== true) return false;
    const ex = row.extractionStatus;
    if (ex === 'done') return true;
    if (ex == null) return true;
    return false;
  }
  if ((RUNTIME_RETRIEVAL_NON_DOCUMENT_SOURCE_TYPES as readonly string[]).includes(String(st))) {
    const ex = row.extractionStatus;
    return ex === 'not_required' || ex == null;
  }
  return false;
}
