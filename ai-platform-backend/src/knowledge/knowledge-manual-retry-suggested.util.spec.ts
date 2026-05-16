import {
  isTrainingManualRetrySuggested,
  resolveTrainingFailureCode,
} from './knowledge-manual-retry-suggested.util';

describe('knowledge-manual-retry-suggested.util', () => {
  describe('resolveTrainingFailureCode', () => {
    it('returns stuck_recovery_limit when raw error contains token', () => {
      expect(resolveTrainingFailureCode('prefix stuck_recovery_limit suffix')).toBe('stuck_recovery_limit');
    });

    it('returns null when empty', () => {
      expect(resolveTrainingFailureCode(null)).toBe(null);
    });
  });

  describe('isTrainingManualRetrySuggested', () => {
    it('is false unless lifecycle is failed', () => {
      expect(
        isTrainingManualRetrySuggested({
          knowledgeItemTrainingStatus: 'queued',
          trainingError: 'stuck_recovery_limit',
        }),
      ).toBe(false);
    });

    it('is true when failed and error contains stuck_recovery_limit', () => {
      expect(
        isTrainingManualRetrySuggested({
          knowledgeItemTrainingStatus: 'failed',
          trainingError: 'stuck_recovery_limit',
        }),
      ).toBe(true);
    });

    it('is true when failed and trainingFailureCode matches even if display trainingError is humanized', () => {
      expect(
        isTrainingManualRetrySuggested({
          knowledgeItemTrainingStatus: 'failed',
          trainingError: 'Something went wrong; please retry.',
          trainingFailureCode: 'stuck_recovery_limit',
        }),
      ).toBe(true);
    });
  });
});
