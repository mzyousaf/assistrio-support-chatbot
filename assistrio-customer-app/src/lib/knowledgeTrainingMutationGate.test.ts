import { describe, expect, it } from 'vitest';
import {
  getKnowledgeTrainingMutationBlockReason,
  isKnowledgeTrainingMutationBlocked,
  KNOWLEDGE_TRAINING_GATE_DUE_SOON_MS,
  knowledgeTrainingGateInputFromPollRow,
} from './knowledgeTrainingMutationGate';

describe('getKnowledgeTrainingMutationBlockReason', () => {
  it('blocks when isTraining', () => {
    expect(getKnowledgeTrainingMutationBlockReason({ isTraining: true, status: 'ready' })).toBeTruthy();
  });

  it('blocks when status is processing or queued', () => {
    expect(getKnowledgeTrainingMutationBlockReason({ status: 'processing' })).toBeTruthy();
    expect(getKnowledgeTrainingMutationBlockReason({ status: 'queued' })).toBeTruthy();
  });

  it('blocks when runAfter is within due-soon window', () => {
    const now = 1_700_000_000_000;
    const ra = new Date(now + 5_000).toISOString();
    expect(
      getKnowledgeTrainingMutationBlockReason({ status: 'pending', runAfter: ra }, now),
    ).toBeTruthy();
  });

  it('does not block ready without pipeline flags', () => {
    expect(getKnowledgeTrainingMutationBlockReason({ status: 'ready', isTraining: false })).toBeNull();
  });

  it('does not block when runAfter is far future', () => {
    const now = 1_700_000_000_000;
    const ra = new Date(now + KNOWLEDGE_TRAINING_GATE_DUE_SOON_MS + 60_000).toISOString();
    expect(getKnowledgeTrainingMutationBlockReason({ status: 'pending', runAfter: ra }, now)).toBeNull();
  });

  it('merges poll + row in knowledgeTrainingGateInputFromPollRow', () => {
    const input = knowledgeTrainingGateInputFromPollRow(
      { status: 'ready', isTraining: true },
      { trainingStatus: 'pending' },
    );
    expect(input.isTraining).toBe(true);
    expect(input.status).toBe('ready');
  });
});

describe('isKnowledgeTrainingMutationBlocked', () => {
  it('matches resolveKnowledgeTrainingGateMessage truthiness', () => {
    expect(isKnowledgeTrainingMutationBlocked({ status: 'processing' }, {})).toBe(true);
    expect(isKnowledgeTrainingMutationBlocked({ status: 'ready' }, {})).toBe(false);
  });
});
