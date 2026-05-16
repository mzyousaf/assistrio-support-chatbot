import {
  computeTrainingTimeEstimateSeconds,
  trainingTimeEstimateLabel,
  TRAINING_ESTIMATE_DOCUMENT_BUFFER_SECONDS,
} from './knowledge-queue-estimate.util';

describe('computeTrainingTimeEstimateSeconds', () => {
  it('adds wait time to character-based work', () => {
    const s = computeTrainingTimeEstimateSeconds({
      workloadCharacters: 15_000,
      datasheetRowCount: 0,
      documentItemCount: 0,
      waitUntilStartSeconds: 30,
    });
    expect(s).toBe(30 + 60);
  });

  it('adds per-document buffer', () => {
    const s = computeTrainingTimeEstimateSeconds({
      workloadCharacters: 0,
      datasheetRowCount: 0,
      documentItemCount: 2,
      waitUntilStartSeconds: 0,
    });
    expect(s).toBe(2 * TRAINING_ESTIMATE_DOCUMENT_BUFFER_SECONDS);
  });
});

describe('trainingTimeEstimateLabel', () => {
  it('returns bucket labels', () => {
    expect(trainingTimeEstimateLabel(0)).toBe('Less than a minute');
    expect(trainingTimeEstimateLabel(30)).toBe('Less than a minute');
    expect(trainingTimeEstimateLabel(90)).toBe('About 1–2 minutes');
    expect(trainingTimeEstimateLabel(3 * 60 + 1)).toBe('About 3–5 minutes');
    expect(trainingTimeEstimateLabel(6 * 60)).toBe('About 5–10 minutes');
    expect(trainingTimeEstimateLabel(20 * 60)).toBe('More than 10 minutes');
  });
});
