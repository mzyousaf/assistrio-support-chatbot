import { describe, expect, it } from 'vitest';
import {
  buildTranslationPatchPayload,
  normalizeTranslationState,
  shouldShowFixedLanguageControl,
} from './translationSettings';

describe('translationSettings helpers', () => {
  it('normalizes default translation settings to english_only disabled', () => {
    expect(normalizeTranslationState(undefined)).toEqual({
      enabled: false,
      mode: 'english_only',
      fixedLanguage: 'English',
    });
  });

  it('builds auto mode sparse patch payload', () => {
    expect(
      buildTranslationPatchPayload({
        enabled: true,
        mode: 'auto',
        fixedLanguage: 'French',
      }),
    ).toEqual({
      translationSettings: {
        enabled: true,
        mode: 'auto',
        transcriptLanguage: 'english',
      },
    });
  });

  it('requires fixedLanguage in fixed mode payload', () => {
    expect(
      buildTranslationPatchPayload({
        enabled: true,
        mode: 'fixed',
        fixedLanguage: 'French',
      }),
    ).toEqual({
      translationSettings: {
        enabled: true,
        mode: 'fixed',
        fixedLanguage: 'French',
        transcriptLanguage: 'english',
      },
    });
  });

  it('shows fixed language control only for enabled fixed mode', () => {
    expect(shouldShowFixedLanguageControl(false, 'fixed')).toBe(false);
    expect(shouldShowFixedLanguageControl(true, 'auto')).toBe(false);
    expect(shouldShowFixedLanguageControl(true, 'fixed')).toBe(true);
  });
});
