import { humanizeDocumentIngestFailureReason } from './ingestion-failure-message.util';

describe('humanizeDocumentIngestFailureReason', () => {
  it('maps empty/no-text extraction errors to readable copy', () => {
    expect(humanizeDocumentIngestFailureReason('No readable text found')).toBe('No readable text found');
    expect(humanizeDocumentIngestFailureReason('extraction_empty_text')).toBe('No readable text found');
    expect(humanizeDocumentIngestFailureReason('extraction_failed')).toBe('No readable text found');
    expect(humanizeDocumentIngestFailureReason(' extraction_empty ')).toBe('No readable text found');
  });

  it('does not map chunking/embed failures to unreadable-text copy', () => {
    expect(humanizeDocumentIngestFailureReason('no_chunks_created')).toBe('no_chunks_created');
    expect(humanizeDocumentIngestFailureReason('embedding_failed')).toBe('embedding_failed');
    expect(humanizeDocumentIngestFailureReason('NO_CHUNKS')).toBe('NO_CHUNKS');
  });

  it('passthrough trimmed reason when unrecognized', () => {
    expect(humanizeDocumentIngestFailureReason('something_else')).toBe('something_else');
    expect(humanizeDocumentIngestFailureReason('')).toBe('ingestion_failed');
  });
});
