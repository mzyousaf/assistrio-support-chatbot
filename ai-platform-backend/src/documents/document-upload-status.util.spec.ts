import { describe, expect, it } from '@jest/globals';
import { normalizeDocumentUploadStatus } from './document-upload-status.util';

describe('normalizeDocumentUploadStatus', () => {
  it('maps legacy training labels to uploaded', () => {
    expect(normalizeDocumentUploadStatus('ready')).toBe('uploaded');
    expect(normalizeDocumentUploadStatus('queued')).toBe('uploaded');
    expect(normalizeDocumentUploadStatus('processing')).toBe('uploaded');
  });

  it('keeps canonical upload lifecycle', () => {
    expect(normalizeDocumentUploadStatus('uploaded')).toBe('uploaded');
    expect(normalizeDocumentUploadStatus('uploading')).toBe('uploading');
    expect(normalizeDocumentUploadStatus('upload_failed')).toBe('upload_failed');
  });

  it('maps failed to upload_failed when error looks like storage', () => {
    expect(normalizeDocumentUploadStatus('failed', 's3 upload timed out')).toBe('upload_failed');
  });

  it('maps failed without storage hint to uploaded (legacy training failure)', () => {
    expect(normalizeDocumentUploadStatus('failed', 'no_embeddings_saved')).toBe('uploaded');
  });
});
