import {
  DEFAULT_AGENT_TRAINING_PIPELINE_STALE_MINUTES,
  kbPipelineActivityFreshMongoClause,
  pipelineTouchCutoffFromStaleMinutes,
} from './agent-training-pipeline-staleness.util';

describe('agent-training-pipeline-staleness.util', () => {
  it('pipelineTouchCutoffFromStaleMinutes subtracts minutes', () => {
    const now = new Date('2026-05-03T12:00:00.000Z');
    const c = pipelineTouchCutoffFromStaleMinutes(now, 30);
    expect(c.toISOString()).toBe('2026-05-03T11:30:00.000Z');
  });

  it('pipelineTouchCutoffFromStaleMinutes clamps invalid to default window', () => {
    const now = new Date('2026-05-03T12:00:00.000Z');
    const c = pipelineTouchCutoffFromStaleMinutes(now, NaN);
    expect(c.getTime()).toBe(now.getTime() - DEFAULT_AGENT_TRAINING_PIPELINE_STALE_MINUTES * 60_000);
  });

  it('kbPipelineActivityFreshMongoClause builds $or on activity fields', () => {
    const cutoff = new Date('2026-01-01T00:00:00.000Z');
    expect(kbPipelineActivityFreshMongoClause(cutoff)).toEqual({
      $or: [
        { updatedAt: { $gte: cutoff } },
        { lastTrainingStartedAt: { $gte: cutoff } },
        { lastQueuedAt: { $gte: cutoff } },
        { extractedAt: { $gte: cutoff } },
      ],
    });
  });
});
