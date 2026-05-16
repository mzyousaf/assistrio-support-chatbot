import { fileSubdocFromDocumentSyncInputs, mergedDocumentKbFileMetaFromSync } from './knowledge-base-document-sync-fields.util';

describe('knowledge-base-document-sync-fields.util', () => {
  it('fileSubdoc requires non-empty bucket and key', () => {
    expect(fileSubdocFromDocumentSyncInputs({ s3Bucket: '', s3Key: '' })).toBeUndefined();
    expect(
      fileSubdocFromDocumentSyncInputs({
        fileName: 'a.pdf',
        fileType: 'application/pdf',
        fileSize: 100,
        s3Bucket: ' b ',
        s3Key: ' k ',
      }),
    ).toMatchObject({
      originalName: 'a.pdf',
      storageBucket: 'b',
      storageKey: 'k',
      uploadStatus: 'uploaded',
    });
  });

  it('mergedDocumentKbFileMetaFromSync merges url/session/storage onto S3 subdoc', () => {
    expect(mergedDocumentKbFileMetaFromSync({ url: ' https://x/y ' }) ?? {}).toEqual({
      url: 'https://x/y',
    });
    expect(
      mergedDocumentKbFileMetaFromSync({ url: '', storage: 's3', uploadSessionId: '  sid  ' }) ?? {},
    ).toEqual({
      storage: 's3',
      uploadSessionId: 'sid',
    });
  });

  it('mergedDocumentKbFileMetaFromSync includes S3 fields when bucket+key valid', () => {
    const m =
      mergedDocumentKbFileMetaFromSync({
        fileName: 'a.pdf',
        s3Bucket: 'b',
        s3Key: 'k',
        url: 'https://x/y',
      }) ?? {};
    expect(m.storageBucket).toBe('b');
    expect(m.storageKey).toBe('k');
    expect(m.url).toBe('https://x/y');
  });
});
