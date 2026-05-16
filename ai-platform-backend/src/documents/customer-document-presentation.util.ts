import { effectiveKbDocumentFileMetaLean } from '../knowledge/knowledge-base-document-sync-fields.util';

/** Stable list/detail names for KB-backed document rows (customer `/documents`). */
export function resolveCustomerDocumentPresentationNames(docRow: Record<string, unknown>): {
  titleHeadline: string;
  displayName: string;
  originalFilename: string | null;
} {
  const r = docRow as { title?: unknown; fileMeta?: unknown; file?: unknown; sourceMeta?: unknown };
  const fm = effectiveKbDocumentFileMetaLean(r);
  const fmObj = ((r.fileMeta ?? r.file) as Record<string, unknown>) ?? {};
  const sm = (r.sourceMeta as Record<string, unknown>) ?? {};
  const storedTitle = typeof r.title === 'string' ? r.title.trim() : '';

  const fromMetaFilename =
    typeof fmObj.filename === 'string' && fmObj.filename.trim() ? fmObj.filename.trim() : '';
  const fromSourceOriginal =
    typeof sm.originalName === 'string' && sm.originalName.trim() ? sm.originalName.trim() : '';
  const fromMetaOriginal =
    typeof fm.originalName === 'string' && fm.originalName.trim() ? fm.originalName.trim() : '';

  const originalFilenameCandidates = [
    fromMetaOriginal ? fromMetaOriginal : null,
    fromMetaFilename ? fromMetaFilename : null,
    fromSourceOriginal ? fromSourceOriginal : null,
  ].filter((x): x is string => Boolean(x));
  const originalFilename = originalFilenameCandidates.length ? originalFilenameCandidates[0]! : null;

  const headline =
    storedTitle || fromMetaOriginal || fromMetaFilename || fromSourceOriginal || 'Untitled document';

  return { titleHeadline: headline, displayName: headline, originalFilename };
}
