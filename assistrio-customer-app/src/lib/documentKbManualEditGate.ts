import type { CustomerWorkspaceDocument } from '@/api/types';

/** Mirrors backend `documentEligibleForTrainingBuckets` in `knowledge-extraction-status.util.ts`. */
function documentRowEligibleForKbManualPatch(row: {
  sourceType?: string;
  extractionStatus?: string | null;
  isContentExtracted?: boolean;
}): boolean {
  const st = typeof row.sourceType === 'string' ? row.sourceType.trim() : '';
  if (st && st !== 'document') return true;
  const raw = typeof row.extractionStatus === 'string' ? row.extractionStatus.trim().toLowerCase() : '';
  if (raw === 'done') return true;
  return row.isContentExtracted === true;
}

/** True when the customer may open the editor and PATCH document title/body. */
export function documentKbManualEditAllowed(doc: CustomerWorkspaceDocument | null): boolean {
  if (!doc) return false;
  return documentRowEligibleForKbManualPatch(doc);
}
