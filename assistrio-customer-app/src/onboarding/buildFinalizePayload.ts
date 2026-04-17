import type { CustomerBotDetail } from '../api/types';

/** Build a full finalize body.payload from the latest GET bot shape (matches normalizeBotPayload). */
export function buildFinalizePayloadFromBot(
  bot: CustomerBotDetail,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const categories = Array.isArray(bot.categories)
    ? (bot.categories as unknown[]).map((e) => String(e).trim()).filter(Boolean)
    : typeof bot.category === 'string' && bot.category.trim()
      ? [bot.category.trim()]
      : [];

  const personality =
    bot.personality && typeof bot.personality === 'object'
      ? (bot.personality as Record<string, unknown>)
      : {};
  const config = bot.config && typeof bot.config === 'object' ? (bot.config as Record<string, unknown>) : {};

  const faqsRaw = Array.isArray(bot.faqs) ? (bot.faqs as unknown[]) : [];
  const faqs: Array<{ question: string; answer: string; active?: boolean }> = [];
  for (const item of faqsRaw) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;
    const question = String(f.question ?? '').trim();
    const answer = String(f.answer ?? '').trim();
    if (!question || !answer) continue;
    faqs.push({ question, answer, active: f.active !== false });
  }

  const base: Record<string, unknown> = {
    name: String(bot.name ?? '').trim() || 'My assistant',
    shortDescription: String(bot.shortDescription ?? '').trim() || undefined,
    description: String(bot.description ?? '').trim() || undefined,
    categories,
    welcomeMessage: String(bot.welcomeMessage ?? '').trim() || undefined,
    knowledgeDescription: String(bot.knowledgeDescription ?? '').trim() || undefined,
    faqs,
    exampleQuestions: Array.isArray(bot.exampleQuestions)
      ? (bot.exampleQuestions as unknown[]).map((q) => String(q ?? '').trim()).filter(Boolean)
      : undefined,
    personality: Object.keys(personality).length ? personality : undefined,
    config: Object.keys(config).length ? config : undefined,
    includeNameInKnowledge: bot.includeNameInKnowledge === true,
    includeTaglineInKnowledge: bot.includeTaglineInKnowledge === true,
    includeNotesInKnowledge: bot.includeNotesInKnowledge !== false,
    isPublic: bot.isPublic !== false,
    visibility: bot.visibility === 'private' ? 'private' : 'public',
    messageLimitMode: bot.messageLimitMode === 'fixed_total' ? 'fixed_total' : 'none',
    messageLimitTotal: typeof bot.messageLimitTotal === 'number' ? bot.messageLimitTotal : null,
    messageLimitUpgradeMessage:
      typeof bot.messageLimitUpgradeMessage === 'string' ? bot.messageLimitUpgradeMessage : null,
    leadCapture: bot.leadCapture,
    chatUI: bot.chatUI,
  };

  return { ...base, ...overrides };
}
