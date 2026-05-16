import {
  legacyTrainingStatusFieldFromDisplayPhase,
  resolveAgentTrainingDisplayPhase,
  resolveCanonicalAgentTrainingDisplayPhase,
} from './agent-training-status-priority.util';

describe('resolveCanonicalAgentTrainingDisplayPhase', () => {
  const base = {
    totalTrackedItems: 5,
    readyItems: 2,
    failedItems: 0,
    actionableItems: 0,
    trainingPipelineItems: 0,
    extractingCount: 0,
    datasheetImportPipelineCount: 0,
    trainingQueuedCount: 0,
    trainingProcessingCount: 0,
  };

  it('prioritizes importing over training_required when datasheet import is active', () => {
    expect(
      resolveCanonicalAgentTrainingDisplayPhase({
        ...base,
        actionableItems: 3,
        datasheetImportPipelineCount: 1,
      }),
    ).toBe('importing');
  });

  it('prioritizes extracting over training_required', () => {
    expect(
      resolveCanonicalAgentTrainingDisplayPhase({
        ...base,
        actionableItems: 4,
        extractingCount: 1,
      }),
    ).toBe('extracting');
  });

  it('prioritizes training over training_required when queue is active', () => {
    expect(
      resolveCanonicalAgentTrainingDisplayPhase({
        ...base,
        actionableItems: 2,
        trainingPipelineItems: 1,
      }),
    ).toBe('training');
  });

  it('uses supplement training counts for training phase', () => {
    expect(
      resolveCanonicalAgentTrainingDisplayPhase({
        ...base,
        actionableItems: 1,
        trainingQueuedCount: 2,
      }),
    ).toBe('training');
  });

  it('returns failed when no ready and some failed', () => {
    expect(
      resolveCanonicalAgentTrainingDisplayPhase({
        ...base,
        readyItems: 0,
        failedItems: 2,
        actionableItems: 0,
      }),
    ).toBe('failed');
  });

  it('returns partially_ready when both ready and failed', () => {
    expect(
      resolveCanonicalAgentTrainingDisplayPhase({
        ...base,
        readyItems: 2,
        failedItems: 1,
        actionableItems: 0,
      }),
    ).toBe('partially_ready');
  });

  it('returns empty when no tracked items', () => {
    expect(
      resolveCanonicalAgentTrainingDisplayPhase({
        ...base,
        totalTrackedItems: 0,
        readyItems: 0,
      }),
    ).toBe('empty');
  });
});

describe('legacyTrainingStatusFieldFromDisplayPhase', () => {
  it('maps empty to trained so legacy clients do not treat no-KB as needs_training', () => {
    expect(legacyTrainingStatusFieldFromDisplayPhase('empty')).toBe('trained');
  });
});

describe('resolveAgentTrainingDisplayPhase (legacy 3-bucket)', () => {
  it('prefers in-flight training over actionable', () => {
    expect(resolveAgentTrainingDisplayPhase(3, 2)).toBe('training');
  });

  it('returns needs_training when actionable only', () => {
    expect(resolveAgentTrainingDisplayPhase(2, 0)).toBe('needs_training');
  });

  it('returns trained when idle', () => {
    expect(resolveAgentTrainingDisplayPhase(0, 0)).toBe('trained');
  });
});
