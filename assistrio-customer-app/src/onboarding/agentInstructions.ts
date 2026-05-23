import type { CustomerBotDetail } from '../api/types';

/**
 * Default `personality.description` / `systemPrompt` seeded on draft create
 * (`default-new-bot.payload.ts` behavior.description). Used to distinguish template
 * copy from user-authored agent instructions.
 */
export const DEFAULT_AGENT_INSTRUCTIONS_TEMPLATE =
  'You are an AI support assistant Assistrio. Help users find answers, guide them through documentation, and provide helpful explanations. If you do not know the answer, politely say so and suggest where they can find more information.';

export const MIN_AGENT_INSTRUCTIONS_LENGTH = 80;

export function minAgentInstructionsError(): string {
  return `Describe your AI agent in at least ${MIN_AGENT_INSTRUCTIONS_LENGTH} characters.`;
}

export function emptyAgentInstructionsError(): string {
  return `Describe your AI agent is required — add at least ${MIN_AGENT_INSTRUCTIONS_LENGTH} characters.`;
}

function personalityRecord(bot: CustomerBotDetail | null): Record<string, unknown> {
  if (!bot?.personality || typeof bot.personality !== 'object' || Array.isArray(bot.personality)) {
    return {};
  }
  return bot.personality as Record<string, unknown>;
}

function isTemplateInstructions(text: string): boolean {
  return text.trim() === DEFAULT_AGENT_INSTRUCTIONS_TEMPLATE;
}

/** Load agent instructions for the onboarding textarea (resume + legacy drafts). */
export function getAgentInstructionsFromBot(bot: CustomerBotDetail | null): string {
  if (!bot) return '';
  const p = personalityRecord(bot);
  const pd = String(p.description ?? '').trim();
  const sp = String(p.systemPrompt ?? '').trim();

  if (pd && !isTemplateInstructions(pd)) return pd;
  if (sp && !isTemplateInstructions(sp)) return sp;

  // Legacy describe step (pre–Profile split): saved the same text to bot.description and personality.
  const botDesc = String(bot.description ?? '').trim();
  if (botDesc && pd && sp && pd === sp && pd === botDesc && !isTemplateInstructions(pd)) {
    return pd;
  }

  return '';
}

/** True when the user has authored agent instructions (not draft template defaults). */
export function hasUserAgentInstructions(bot: CustomerBotDetail | null): boolean {
  return getAgentInstructionsFromBot(bot).trim().length > 0;
}

/** Load agent instructions from workspace onboarding draft. */
export function getAgentInstructionsFromDraft(
  draft: { instructions?: { description?: string; systemPrompt?: string } } | null | undefined,
): string {
  if (!draft?.instructions) return '';
  const pd = String(draft.instructions.description ?? '').trim();
  const sp = String(draft.instructions.systemPrompt ?? '').trim();
  if (pd && !isTemplateInstructions(pd)) return pd;
  if (sp && !isTemplateInstructions(sp)) return sp;
  return '';
}

export function hasUserAgentInstructionsFromDraft(
  draft: { instructions?: { description?: string; systemPrompt?: string } } | null | undefined,
): boolean {
  return getAgentInstructionsFromDraft(draft).trim().length >= MIN_AGENT_INSTRUCTIONS_LENGTH;
}
