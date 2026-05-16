import {
  kbHasHadSuccessfulTrain,
  kbLastSuccessfulTrainInstant,
  kbTrainingFailureMessage,
} from './knowledge-base-item-canonical.util';

describe('knowledge-base-item-canonical.util', () => {
  it('kbTrainingFailureMessage returns trimmed trainingError', () => {
    expect(kbTrainingFailureMessage({ trainingError: '  oops ' })).toBe('oops');
    expect(kbTrainingFailureMessage({ trainingError: '' })).toBe(null);
    expect(kbTrainingFailureMessage({ trainingError: null })).toBe(null);
    expect(kbTrainingFailureMessage({})).toBe(null);
  });

  it('kbTrainingFailureMessage replaces stale document ingest codes', () => {
    expect(kbTrainingFailureMessage({ trainingError: 'stale_document_text' })).toBe(
      'This document changed while training was running. Wait for uploads to finish, then use Retry.',
    );
    expect(kbTrainingFailureMessage({ trainingError: 'stale_document_text_loop' })).toBe(
      'Training stopped because this document kept changing while we were training it. Pause edits briefly, then use Retry.',
    );
  });

  it('kbLastSuccessfulTrainInstant returns lastTrainedAt when valid Date', () => {
    const a = new Date('2020-01-01T00:00:00.000Z');
    expect(kbLastSuccessfulTrainInstant({ lastTrainedAt: a })).toBe(a);
    expect(kbLastSuccessfulTrainInstant({})).toBeUndefined();
    expect(kbLastSuccessfulTrainInstant({ lastTrainedAt: null })).toBeUndefined();
  });

  it('kbHasHadSuccessfulTrain mirrors kbLastSuccessfulTrainInstant', () => {
    expect(kbHasHadSuccessfulTrain({ lastTrainedAt: new Date() })).toBe(true);
    expect(kbHasHadSuccessfulTrain({})).toBe(false);
  });
});
