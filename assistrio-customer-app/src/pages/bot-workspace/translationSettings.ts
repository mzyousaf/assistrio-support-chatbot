import type { CustomerBotTranslationSettings } from '@/api/types';

export type TranslationMode = 'english_only' | 'auto' | 'fixed';

export function normalizeTranslationState(
  input: CustomerBotTranslationSettings | undefined,
): { enabled: boolean; mode: TranslationMode; fixedLanguage: string } {
  const enabled = input?.enabled === true;
  const mode = enabled && (input?.mode === 'auto' || input?.mode === 'fixed') ? input.mode : 'english_only';
  const fixedLanguage =
    typeof input?.fixedLanguage === 'string' && input.fixedLanguage.trim()
      ? input.fixedLanguage.trim()
      : 'English';
  return { enabled, mode, fixedLanguage };
}

export function buildTranslationPatchPayload(params: {
  enabled: boolean;
  mode: TranslationMode;
  fixedLanguage: string;
}) {
  const effectiveMode: TranslationMode = params.enabled ? params.mode : 'english_only';
  return {
    translationSettings: {
      enabled: params.enabled,
      mode: effectiveMode,
      ...(effectiveMode === 'fixed' ? { fixedLanguage: params.fixedLanguage } : {}),
      transcriptLanguage: 'english' as const,
    },
  };
}

export function shouldShowFixedLanguageControl(enabled: boolean, mode: TranslationMode): boolean {
  return enabled && mode === 'fixed';
}
