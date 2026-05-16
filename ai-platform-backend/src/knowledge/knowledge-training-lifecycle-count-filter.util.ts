/**
 * Training-status aggregates (`status=queued|processing|failed|ready`) must not treat documents
 * in non-terminal extraction phases as part of the **training** pipeline.
 *
 * Legacy rows may omit `extractionStatus` while `isContentExtracted===true` after `done` extraction.
 */
export function trainingLifecycleCountBaseClause(): Record<string, unknown> {
  return {
    $or: [
      { sourceType: { $ne: 'document' } },
      { extractionStatus: 'done' },
      {
        sourceType: 'document',
        isContentExtracted: true,
        $or: [{ extractionStatus: { $exists: false } }, { extractionStatus: null }],
      },
    ],
  };
}
