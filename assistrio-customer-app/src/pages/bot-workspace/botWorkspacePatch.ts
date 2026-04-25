import type { CustomerBotDetail } from '../../api/types';

type BotWithExtras = CustomerBotDetail & Record<string, unknown>;

/** Shared PATCH baseline so workspace pages only override fields they edit. */
export function preserveUneditedBotFields(bot: CustomerBotDetail): Record<string, unknown> {
  const b = bot as BotWithExtras;
  return {
    status: bot.status === 'published' ? 'published' : 'draft',
    isPublic: bot.isPublic !== false,
    visibility: bot.visibility === 'private' ? 'private' : 'public',
    messageLimitMode: bot.messageLimitMode === 'fixed_total' ? 'fixed_total' : 'none',
    messageLimitTotal: bot.messageLimitTotal ?? null,
    messageLimitUpgradeMessage: bot.messageLimitUpgradeMessage ?? null,
    chatUI: b.chatUI,
    leadCapture: b.leadCapture,
    faqs: Array.isArray(bot.faqs) ? bot.faqs : [],
    exampleQuestions: Array.isArray(bot.exampleQuestions) ? bot.exampleQuestions : [],
    welcomeMessage: bot.welcomeMessage ?? '',
    welcomeMessageEnabled: bot.welcomeMessageEnabled !== false,
    knowledgeDescription: bot.knowledgeDescription ?? '',
    categories: Array.isArray(bot.categories)
      ? bot.categories
      : bot.category
        ? [bot.category]
        : [],
    includeTaglineInKnowledge: bot.includeTaglineInKnowledge === true,
    includeNotesInKnowledge: bot.includeNotesInKnowledge !== false,
    personality: b.personality,
    config: b.config,
    ...(typeof b.openaiApiKeyOverride === 'string' && b.openaiApiKeyOverride.trim()
      ? { openaiApiKeyOverride: b.openaiApiKeyOverride.trim() }
      : {}),
    ...(typeof b.whisperApiKeyOverride === 'string' && b.whisperApiKeyOverride
      ? { whisperApiKeyOverride: b.whisperApiKeyOverride }
      : {}),
  };
}

export function baseIdentityFields(bot: CustomerBotDetail): Record<string, unknown> {
  const b = bot as BotWithExtras;
  return {
    name: String(bot.name ?? '').trim(),
    shortDescription: String(bot.shortDescription ?? '').trim(),
    description: String(bot.description ?? '').trim(),
    imageUrl: String(b.imageUrl ?? '').trim(),
    avatarEmoji: String(b.avatarEmoji ?? '').trim(),
    includeNameInKnowledge: bot.includeNameInKnowledge === true,
  };
}

export function parseChatUi(bot: CustomerBotDetail): Record<string, unknown> {
  const raw = (bot as BotWithExtras).chatUI;
  return raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
}
