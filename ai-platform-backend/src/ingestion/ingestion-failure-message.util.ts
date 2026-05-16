/** Normalizes worker exceptions into stable trainingError text on document KB items. */
export function humanizeDocumentIngestFailureReason(raw: string): string {
  const r = String(raw ?? '').trim();
  if (!r) return 'ingestion_failed';
  const low = r.toLowerCase();
  if (low === 'no readable text found' || low === 'extraction_empty_text') return 'No readable text found';
  if (low.includes('file_url_missing')) return 'No downloadable file source';
  if (low.includes('extraction_failed') || low.includes('extraction_empty') || /^extraction/i.test(low)) {
    return 'No readable text found';
  }
  return r;
}
