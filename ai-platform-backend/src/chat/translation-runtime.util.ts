import type { BotLike } from './chat-engine.types';

export type EffectiveTranslationSettings = {
  enabled: boolean;
  mode: 'english_only' | 'auto' | 'fixed';
  fixedLanguage?: string;
};

export function resolveEffectiveTranslationSettings(bot: BotLike): EffectiveTranslationSettings {
  const raw = bot.translationSettings;
  const enabled = raw?.enabled === true;
  const rawMode = String(raw?.mode ?? '').trim().toLowerCase();
  const fixedLanguage = typeof raw?.fixedLanguage === 'string' ? raw.fixedLanguage.trim() : '';
  if (!enabled) return { enabled: false, mode: 'english_only' };
  if (rawMode === 'fixed' && fixedLanguage) return { enabled: true, mode: 'fixed', fixedLanguage };
  if (rawMode === 'auto') return { enabled: true, mode: 'auto' };
  return { enabled: true, mode: 'english_only' };
}
