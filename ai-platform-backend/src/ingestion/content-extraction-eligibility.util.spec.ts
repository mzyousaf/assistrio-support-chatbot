import {
  kbRowEligibleForQueuedContentExtraction,
  kbRowHasUploadedFileSource,
  shouldMarkDocumentKbUploadFailedForUnusableSource,
} from './content-extraction-eligibility.util';

describe('content-extraction-eligibility.util', () => {
  it('kbRowHasUploadedFileSource is true for S3 keys and not upload_failed', () => {
    expect(
      kbRowHasUploadedFileSource({
        fileMeta: { storageBucket: 'b', storageKey: 'k', uploadStatus: 'uploaded' },
      }),
    ).toBe(true);
    expect(
      kbRowHasUploadedFileSource({
        fileMeta: { storageBucket: 'b', storageKey: 'k', uploadStatus: 'upload_failed' },
      }),
    ).toBe(false);
  });

  it('kbRowHasUploadedFileSource is true for https URL on fileMeta', () => {
    expect(
      kbRowHasUploadedFileSource({
        fileMeta: { url: 'https://example.com/a.pdf', uploadStatus: 'uploaded' },
      }),
    ).toBe(true);
  });

  it('kbRowEligible rejects when extracted', () => {
    expect(
      kbRowEligibleForQueuedContentExtraction({
        isContentExtracted: true,
        content: '',
        fileMeta: { storageBucket: 'b', storageKey: 'k' },
      }),
    ).toBe(false);
  });

  it('kbRowEligible accepts empty content when file source exists', () => {
    expect(
      kbRowEligibleForQueuedContentExtraction({
        isContentExtracted: false,
        content: '  ',
        fileMeta: { storageBucket: 'b', storageKey: 'k' },
      }),
    ).toBe(true);
  });

  it('shouldMarkDocumentKbUploadFailed skips manual content and valid S3', () => {
    expect(
      shouldMarkDocumentKbUploadFailedForUnusableSource({
        isContentExtracted: false,
        content: 'hello',
        fileMeta: {},
      }),
    ).toBe(false);
    expect(
      shouldMarkDocumentKbUploadFailedForUnusableSource({
        isContentExtracted: false,
        content: '',
        fileMeta: { storageBucket: 'b', storageKey: 'k', uploadStatus: 'uploaded' },
      }),
    ).toBe(false);
  });

  it('shouldMarkDocumentKbUploadFailed true when no source and not already failed', () => {
    expect(
      shouldMarkDocumentKbUploadFailedForUnusableSource({
        isContentExtracted: false,
        content: '',
        fileMeta: {},
      }),
    ).toBe(true);
    expect(
      shouldMarkDocumentKbUploadFailedForUnusableSource({
        isContentExtracted: false,
        content: '  ',
        fileMeta: { storageBucket: 'b', storageKey: '' },
      }),
    ).toBe(true);
  });

  it('shouldMarkDocumentKbUploadFailed false when multipart session may still complete', () => {
    expect(
      shouldMarkDocumentKbUploadFailedForUnusableSource({
        isContentExtracted: false,
        content: '',
        fileMeta: { uploadSessionId: 'sess-1', storageBucket: '', storageKey: '' },
      }),
    ).toBe(false);
    expect(
      shouldMarkDocumentKbUploadFailedForUnusableSource({
        isContentExtracted: false,
        content: '',
        fileMeta: { uploadSessionId: 'sess-1', storageBucket: 'b', storageKey: '' },
      }),
    ).toBe(false);
  });

  it('shouldMarkDocumentKbUploadFailed false when already upload_failed', () => {
    expect(
      shouldMarkDocumentKbUploadFailedForUnusableSource({
        isContentExtracted: false,
        content: '',
        fileMeta: { uploadStatus: 'upload_failed' },
      }),
    ).toBe(false);
  });
});
