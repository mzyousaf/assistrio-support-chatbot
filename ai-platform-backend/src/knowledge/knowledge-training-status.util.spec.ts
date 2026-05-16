import { normalizeKnowledgeTrainingStatus } from './knowledge-training-status.util';

describe('normalizeKnowledgeTrainingStatus', () => {
  it('passes through known statuses', () => {
    expect(normalizeKnowledgeTrainingStatus('ready')).toBe('ready');
    expect(normalizeKnowledgeTrainingStatus('QUEUED')).toBe('queued');
    expect(normalizeKnowledgeTrainingStatus('ui_only')).toBe('pending'); // unknown legacy value → pending
  });

  it('maps unknown to pending', () => {
    expect(normalizeKnowledgeTrainingStatus('nope')).toBe('pending');
    expect(normalizeKnowledgeTrainingStatus('')).toBe('pending');
    expect(normalizeKnowledgeTrainingStatus(undefined)).toBe('pending');
  });

  it('maps legacy document / job labels to canonical', () => {
    expect(normalizeKnowledgeTrainingStatus('done')).toBe('ready');
    expect(normalizeKnowledgeTrainingStatus('completed')).toBe('ready');
    expect(normalizeKnowledgeTrainingStatus('uploading')).toBe('processing');
    expect(normalizeKnowledgeTrainingStatus('training')).toBe('processing');
    expect(normalizeKnowledgeTrainingStatus('uploaded')).toBe('pending');
    expect(normalizeKnowledgeTrainingStatus('idle')).toBe('pending');
    expect(normalizeKnowledgeTrainingStatus('stale')).toBe('pending');
  });
});
