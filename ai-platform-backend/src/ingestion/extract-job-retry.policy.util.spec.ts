import {
  EXTRACT_JOB_MAX_AUTO_RETRIES,
  EXTRACT_JOB_RETRY_BACKOFF_BASE_MS,
} from '../knowledge/knowledge-pipeline-retry.constants';
import {
  extractFailureDeferRunAfterMs,
  isExtractManualRetrySuggested,
  resolveExtractJobMaxAutoRetries,
} from './extract-job-retry.policy.util';

describe('extract-job-retry.policy.util', () => {
  it('resolveExtractJobMaxAutoRetries matches code constant', () => {
    expect(resolveExtractJobMaxAutoRetries()).toBe(EXTRACT_JOB_MAX_AUTO_RETRIES);
  });

  it('extractFailureDeferRunAfterMs grows with cycle index', () => {
    expect(extractFailureDeferRunAfterMs(0)).toBeLessThanOrEqual(extractFailureDeferRunAfterMs(3));
    expect(extractFailureDeferRunAfterMs(0)).toBeGreaterThanOrEqual(EXTRACT_JOB_RETRY_BACKOFF_BASE_MS);
  });

  it('manual retry suggestion when extract failed and cycles at cap', () => {
    expect(
      isExtractManualRetrySuggested({
        extractStatus: 'failed',
        extractAutoRetryCycles: EXTRACT_JOB_MAX_AUTO_RETRIES - 1,
      }),
    ).toBe(false);
    expect(
      isExtractManualRetrySuggested({
        extractStatus: 'failed',
        extractAutoRetryCycles: EXTRACT_JOB_MAX_AUTO_RETRIES,
      }),
    ).toBe(true);
    expect(isExtractManualRetrySuggested({ extractStatus: 'queued', extractAutoRetryCycles: 99 })).toBe(false);
  });

  it('manual retry suggestion when latest job error is stuck recovery limit', () => {
    expect(
      isExtractManualRetrySuggested({
        extractStatus: 'failed',
        extractAutoRetryCycles: 0,
        latestExtractError: 'stuck_recovery_limit',
      }),
    ).toBe(true);
  });
});
