import type { CustomerBotDetail } from '../api/types';
import { VALID_TONE_VALUES } from '../pages/bot-workspace/behaviorConstants';
import type { OnboardingSessionV1 } from './onboardingSessionStorage';
const LENGTHS = new Set(['short', 'medium', 'long']);

/** Infer completed steps from persisted session + server bot state (resume after refresh). */
export function mergeStepsCompleted(
  session: OnboardingSessionV1 | null,
  bot: CustomerBotDetail | null,
): string[] {
  const set = new Set<string>(session?.stepsCompleted ?? []);
  if (!bot) return Array.from(set);

  if (String(bot.name ?? '').trim()) set.add('agent-profile');

  const pers = bot.personality as Record<string, unknown> | undefined;
  const toneOk = pers && VALID_TONE_VALUES.has(String(pers.tone ?? ''));
  const descOk = String(bot.description ?? '').trim().length > 0;
  const cfg = bot.config as Record<string, unknown> | undefined;
  const lenOk = cfg && LENGTHS.has(String(cfg.responseLength ?? ''));
  if (toneOk && descOk && lenOk) set.add('describe-profile');

  const kd = String(bot.knowledgeDescription ?? '').trim();
  const faqs = Array.isArray(bot.faqs) ? bot.faqs : [];
  const faqOk = faqs.some((f) => String(f.question ?? '').trim() && String(f.answer ?? '').trim());
  if (kd || faqOk) set.add('knowledge-base');

  const ao = Array.isArray(bot.allowedOrigins) ? bot.allowedOrigins : [];
  if (ao.some((o) => String(o.origin ?? '').trim())) set.add('go-live');

  return Array.from(set);
}
