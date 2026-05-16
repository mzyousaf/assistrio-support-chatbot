import { normalizeVisitorMultiChatMax } from '../bots/visitor-multi-chat.util';
import type { BotLike } from './chat-engine.types';

/** Map a runtime bot document (from {@link BotsService.findOneByIdForExternalRuntime}) to {@link BotLike}. */
export function buildBotLikeFromRuntimeDoc(b: Record<string, unknown>): BotLike {
  return {
    _id: (b._id as { toString(): string }),
    ...(b.workspaceId != null ? { workspaceId: String(b.workspaceId) } : {}),
    ...(b.ownerId != null ? { ownerId: String(b.ownerId) } : {}),
    name: (b.name as string) ?? '',
    shortDescription: (b.shortDescription as string) ?? '',
    description: (b.description as string) ?? '',
    category: (b.category as string) ?? '',
    openaiApiKeyOverride: (b.openaiApiKeyOverride as string) ?? undefined,
    welcomeMessage: (b.welcomeMessage as string) ?? '',
    welcomeMessageEnabled:
      (b.welcomeMessageEnabled as boolean | undefined) === false ? false : undefined,
    knowledgeDescription: (b.knowledgeDescription as string) ?? '',
    leadCapture: (b.leadCapture as BotLike['leadCapture']) ?? undefined,
    personality: (b.personality as BotLike['personality']) ?? undefined,
    config: (b.config as BotLike['config']) ?? undefined,
    translationSettings: (b.translationSettings as BotLike['translationSettings']) ?? undefined,
    faqs: (b.faqs as BotLike['faqs']) ?? undefined,
    visitorMultiChatEnabled:
      (b.visitorMultiChatEnabled as boolean | undefined) === true ? true : undefined,
    visitorMultiChatMax: normalizeVisitorMultiChatMax(b.visitorMultiChatMax),
    exampleQuestions: b.exampleQuestions,
  };
}
