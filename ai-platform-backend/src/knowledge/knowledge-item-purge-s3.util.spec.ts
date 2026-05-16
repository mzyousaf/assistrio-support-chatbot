import { Types } from 'mongoose';
import { collectKbPurgeS3Refs } from './knowledge-item-purge-s3.util';

describe('collectKbPurgeS3Refs', () => {
  const itemId = new Types.ObjectId();

  it('dedupes identical bucket/key from tableImportJob and tableImportSession', () => {
    const oid = new Types.ObjectId();
    const refs = collectKbPurgeS3Refs({
      itemLean: { _id: itemId, sourceType: 'table' },
      tableImportJobs: [{ _id: oid, s3Bucket: 'b', s3Key: 'k' }],
      tableImportSessions: [{ _id: new Types.ObjectId(), s3Bucket: 'b', s3Key: 'k' }],
    });
    expect(refs).toHaveLength(1);
    expect(refs[0].provenance).toMatch(/^tableImportJob:/);
  });

  it('adds knowledgeBaseItem.fileMeta S3 pointer when storage is s3 or absent', () => {
    const refs = collectKbPurgeS3Refs({
      itemLean: {
        _id: itemId,
        sourceType: 'document',
        fileMeta: {
          storageBucket: 'priv',
          storageKey: 'docs/a.pdf',
          storage: 's3',
        },
      },
      tableImportJobs: [],
      tableImportSessions: [],
    });
    expect(refs).toEqual([
      expect.objectContaining({
        bucket: 'priv',
        key: 'docs/a.pdf',
        provenance: 'knowledgeBaseItem.fileMeta',
      }),
    ]);
  });

  it('skips fileMeta when storage is https (URL-backed, not an owned S3 object)', () => {
    const refs = collectKbPurgeS3Refs({
      itemLean: {
        _id: itemId,
        sourceType: 'document',
        fileMeta: {
          storageBucket: 'priv',
          storageKey: 'should-not-delete',
          storage: 'https',
          url: 'https://example.com/doc',
        },
      },
      tableImportJobs: [],
      tableImportSessions: [],
    });
    expect(refs).toHaveLength(0);
  });

  it('includes table session keys independently from job', () => {
    const jobId = new Types.ObjectId();
    const sessId = new Types.ObjectId();
    const refs = collectKbPurgeS3Refs({
      itemLean: { _id: itemId, sourceType: 'table' },
      tableImportJobs: [{ _id: jobId, s3Bucket: 'jb', s3Key: 'jk' }],
      tableImportSessions: [{ _id: sessId, s3Bucket: 'sb', s3Key: 'sk' }],
    });
    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.key).sort()).toEqual(['jk', 'sk']);
  });
});
