import { deriveDocumentPipelineDisplay } from './document-pipeline-display.util';

describe('deriveDocumentPipelineDisplay', () => {
  it('upload path', () => {
    expect(deriveDocumentPipelineDisplay({
      uploadDocumentStatus: 'uploading',
      isContentExtracted: false,
      latestExtractJobStatus: null,
      trainingDisplayStatus: 'pending',
    }).stage).toBe('uploading');

    expect(deriveDocumentPipelineDisplay({
      uploadDocumentStatus: 'upload_failed',
      isContentExtracted: false,
      trainingDisplayStatus: 'pending',
    }).stage).toBe('upload_failed');
  });

  it('extract path when not extracted', () => {
    expect(
      deriveDocumentPipelineDisplay({
        uploadDocumentStatus: 'uploaded',
        isContentExtracted: false,
        latestExtractJobStatus: 'processing',
        trainingDisplayStatus: 'processing',
      }).label,
    ).toBe('Extracting text');

    expect(
      deriveDocumentPipelineDisplay({
        uploadDocumentStatus: 'uploaded',
        isContentExtracted: false,
        latestExtractJobStatus: 'failed',
        trainingDisplayStatus: 'failed',
      }).label,
    ).toBe('Extracting text failed');
  });

  it('training path once extracted', () => {
    const base = {
      uploadDocumentStatus: 'uploaded' as const,
      isContentExtracted: true,
      latestExtractJobStatus: 'done',
    };
    expect(deriveDocumentPipelineDisplay({ ...base, trainingDisplayStatus: 'pending' }).stage).toBe('training_required');
    expect(deriveDocumentPipelineDisplay({ ...base, trainingDisplayStatus: 'queued' }).stage).toBe('training_queued');
    expect(deriveDocumentPipelineDisplay({ ...base, trainingDisplayStatus: 'processing' }).stage).toBe('training');
    expect(deriveDocumentPipelineDisplay({ ...base, trainingDisplayStatus: 'ready' }).stage).toBe('passed');
    expect(deriveDocumentPipelineDisplay({ ...base, trainingDisplayStatus: 'failed' }).stage).toBe('training_failed');
  });
});
