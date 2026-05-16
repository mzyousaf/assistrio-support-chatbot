import { describe, expect, it } from 'vitest';
import { formatUsageAudioDurationSeconds } from './usageDurationFormat';

describe('formatUsageAudioDurationSeconds', () => {
  it('returns em dash for empty input', () => {
    expect(formatUsageAudioDurationSeconds(-1)).toBe('—');
    expect(formatUsageAudioDurationSeconds(NaN)).toBe('—');
  });

  it('formats seconds, minutes, and hours', () => {
    expect(formatUsageAudioDurationSeconds(45)).toBe('45s');
    expect(formatUsageAudioDurationSeconds(125)).toBe('2m 5s');
    expect(formatUsageAudioDurationSeconds(3725)).toBe('1h 2m');
  });
});
