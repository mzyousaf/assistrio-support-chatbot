import {
  maxTokensPresetToResponseLength,
  RESPONSE_LENGTH_PRESET_MAX_TOKENS,
  snapMaxTokensToPreset,
} from './response-length-presets.util';

describe('snapMaxTokensToPreset', () => {
  it('exposes nine allowed presets', () => {
    expect(RESPONSE_LENGTH_PRESET_MAX_TOKENS).toEqual([64, 80, 96, 128, 160, 208, 256, 384, 512]);
  });

  it('snaps 288 to nearest preset 256', () => {
    expect(snapMaxTokensToPreset(288)).toBe(256);
  });

  it('snaps to exact plus presets', () => {
    expect(snapMaxTokensToPreset(80)).toBe(80);
    expect(snapMaxTokensToPreset(128)).toBe(128);
    expect(snapMaxTokensToPreset(208)).toBe(208);
    expect(snapMaxTokensToPreset(384)).toBe(384);
  });
});

describe('maxTokensPresetToResponseLength', () => {
  it('maps short/medium/long buckets', () => {
    expect(maxTokensPresetToResponseLength(64)).toBe('short');
    expect(maxTokensPresetToResponseLength(80)).toBe('short');
    expect(maxTokensPresetToResponseLength(96)).toBe('short');
    expect(maxTokensPresetToResponseLength(128)).toBe('medium');
    expect(maxTokensPresetToResponseLength(160)).toBe('medium');
    expect(maxTokensPresetToResponseLength(208)).toBe('long');
    expect(maxTokensPresetToResponseLength(256)).toBe('long');
    expect(maxTokensPresetToResponseLength(384)).toBe('long');
    expect(maxTokensPresetToResponseLength(512)).toBe('long');
  });
});
