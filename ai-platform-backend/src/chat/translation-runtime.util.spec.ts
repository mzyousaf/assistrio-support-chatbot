import { resolveEffectiveTranslationSettings } from './translation-runtime.util';

describe('resolveEffectiveTranslationSettings', () => {
  it('defaults to english_only when disabled or missing', () => {
    expect(resolveEffectiveTranslationSettings({ _id: { toString: () => '1' } })).toEqual({
      enabled: false,
      mode: 'english_only',
    });
    expect(
      resolveEffectiveTranslationSettings({
        _id: { toString: () => '1' },
        translationSettings: { enabled: false, mode: 'auto' },
      }),
    ).toEqual({
      enabled: false,
      mode: 'english_only',
    });
  });

  it('uses auto mode when enabled', () => {
    expect(
      resolveEffectiveTranslationSettings({
        _id: { toString: () => '1' },
        translationSettings: { enabled: true, mode: 'auto' },
      }),
    ).toEqual({
      enabled: true,
      mode: 'auto',
    });
  });

  it('uses fixed mode only with fixedLanguage', () => {
    expect(
      resolveEffectiveTranslationSettings({
        _id: { toString: () => '1' },
        translationSettings: { enabled: true, mode: 'fixed', fixedLanguage: 'French' },
      }),
    ).toEqual({
      enabled: true,
      mode: 'fixed',
      fixedLanguage: 'French',
    });
    expect(
      resolveEffectiveTranslationSettings({
        _id: { toString: () => '1' },
        translationSettings: { enabled: true, mode: 'fixed' },
      }),
    ).toEqual({
      enabled: true,
      mode: 'english_only',
    });
  });
});
