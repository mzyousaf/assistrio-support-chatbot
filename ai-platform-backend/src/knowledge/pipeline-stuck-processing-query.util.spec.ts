import {
  mongoExtractProcessingJobStaleCriteria,
  mongoTrainProcessingJobStaleCriteria,
} from './pipeline-stuck-processing-query.util';

describe('pipeline-stuck-processing-query.util', () => {
  it('train criteria matches startedAt branch', () => {
    const c = new Date('2026-01-01T00:00:00.000Z');
    expect(mongoTrainProcessingJobStaleCriteria(c)).toMatchObject({
      status: 'processing',
      $or: expect.any(Array),
    });
  });

  it('extract criteria includes processingStartedAt branch', () => {
    const c = new Date('2026-01-01T00:00:00.000Z');
    const q = mongoExtractProcessingJobStaleCriteria(c);
    expect(q.status).toBe('processing');
    expect(q.$or).toHaveLength(3);
  });
});
