import { describe, expect, it } from 'vitest';
import { isKnowledgePipelinePollingActive } from './knowledgeTrainingStatus';

describe('isKnowledgePipelinePollingActive', () => {
  it('is false when snapshot is null', () => {
    expect(isKnowledgePipelinePollingActive(null)).toBe(false);
    expect(isKnowledgePipelinePollingActive(undefined)).toBe(false);
  });

  it('is true when any pipeline flag is true', () => {
    expect(isKnowledgePipelinePollingActive({ isTraining: true })).toBe(true);
    expect(isKnowledgePipelinePollingActive({ isImporting: true })).toBe(true);
    expect(isKnowledgePipelinePollingActive({ isExtracting: true })).toBe(true);
    expect(isKnowledgePipelinePollingActive({ isTextExtracting: true })).toBe(true);
    expect(
      isKnowledgePipelinePollingActive({
        isTraining: false,
        isImporting: false,
        isExtracting: false,
        isTextExtracting: false,
        training_queued: true,
      }),
    ).toBe(true);
  });

  it('is false when pipeline flags are off even if counts show pending work', () => {
    expect(
      isKnowledgePipelinePollingActive({
        status: 'trained',
        displayPhase: 'partially_ready',
        isTraining: false,
        isTextExtracting: false,
        isExtracting: false,
        isImporting: false,
        training_queued: false,
        needsTraining: false,
        hasFailed: true,
        counts: { pending: 2, queued: 0, total: 29 },
      }),
    ).toBe(false);
  });
});
