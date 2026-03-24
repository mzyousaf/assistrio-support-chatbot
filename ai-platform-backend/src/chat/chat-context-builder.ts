/**
 * Builds the structured chat context and formats it into the final LLM prompt.
 * System prompt = HOW to answer (behavior only). User prompt = evidence, conversation history, current message.
 * Knowledge is always evidence-first (unified retrieval result).
 */

import type { ChatKnowledgeContext, ChatContextEvidenceItem } from './chat-context.types';
import type { ChatContextLeadCapture } from './chat-context.types';
import { buildSystemPrompt } from './system-prompt.builder';

/** Input for building the full context (from chat engine). Unified evidence only. */
export interface BuildChatContextInput {
  botName: string;
  category?: string;
  personalityPreset?: string;
  personalityDescription?: string;
  thingsToAvoid?: string;
  tone?: string;
  language?: string;
  responseLength?: string;
  systemPrompt?: string;
  leadCapture: ChatContextLeadCapture;
  conversationMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  conversationSummary?: string;
  currentUserMessage: string;
  retrievalConfidence?: 'high' | 'medium' | 'low';
  documentDirectAnswerLikely?: boolean;
  /** Ranked evidence items (from unified retrieval). */
  unifiedEvidence?: ChatContextEvidenceItem[];
  answerability?: {
    evidenceStrongEnough: boolean;
    directAnswerLikely: boolean;
    shouldUseFallback: boolean;
    shouldAnswerGenerally: boolean;
  };
}

/**
 * Build the structured ChatKnowledgeContext from raw inputs.
 */
export function buildChatKnowledgeContext(input: BuildChatContextInput): ChatKnowledgeContext {
  return {
    identity: {
      botName: input.botName,
      category: input.category,
    },
    behavior: {
      personalityPreset: input.personalityPreset,
      personalityDescription: input.personalityDescription,
      thingsToAvoid: input.thingsToAvoid,
      tone: input.tone,
      language: input.language,
      responseLength: input.responseLength,
      systemPrompt: input.systemPrompt,
    },
    knowledge: {
      unifiedEvidence: input.unifiedEvidence?.length ? input.unifiedEvidence : undefined,
    },
    leadCapture: input.leadCapture,
    conversation: {
      messages: input.conversationMessages,
      summary: input.conversationSummary,
    },
    currentUserMessage: input.currentUserMessage,
    retrievalConfidence: input.retrievalConfidence,
    documentDirectAnswerLikely: input.documentDirectAnswerLikely,
    answerability: input.answerability,
  };
}

/**
 * Format the structured context into the final prompt: system message and user message.
 * System = behavior only. User = evidence (if any), conversation history, current message.
 */
export function formatPromptFromContext(ctx: ChatKnowledgeContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const hasEvidence = (ctx.knowledge.unifiedEvidence?.length ?? 0) > 0;

  const systemPrompt = buildSystemPrompt({
    identity: ctx.identity,
    behavior: ctx.behavior,
    leadCapture: ctx.leadCapture,
    retrievalConfidence: ctx.retrievalConfidence,
    hasDocumentSnippets: hasEvidence,
    documentDirectAnswerLikely: ctx.documentDirectAnswerLikely,
    hasAssistantHistory: ctx.conversation.messages.some((m) => m.role === 'assistant'),
    answerability: ctx.answerability,
  });

  const userParts: string[] = [];

  // --- USER: Retrieved Knowledge Evidence ---
  if (hasEvidence) {
    userParts.push('--- Retrieved Knowledge Evidence ---');
    userParts.push('Answer from the following evidence only. Each item has sourceType, title, and optionally section and URL.');
    ctx.knowledge.unifiedEvidence!.forEach((e, i) => {
      const lines: string[] = [];
      lines.push(`[${i + 1}] sourceType: ${e.sourceType}`);
      lines.push(`title: ${e.title}`);
      if (e.section?.trim()) lines.push(`section: ${e.section.trim()}`);
      if (e.url?.trim()) lines.push(`url: ${e.url.trim()}`);
      lines.push(`text: ${(e.text || '').trim().replace(/\n/g, '\n   ')}`);
      userParts.push(lines.join('\n'));
    });
  } else {
    userParts.push('--- Retrieved Knowledge Evidence ---');
    userParts.push('(No information provided. For company-specific questions say you do not have that information at the moment.)');
  }

  // --- USER: Conversation history ---
  userParts.push('\n--- Conversation history ---');
  if (ctx.conversation.summary?.trim()) {
    userParts.push('Summary: ' + ctx.conversation.summary.trim());
  }
  if (ctx.conversation.messages.length === 0) {
    userParts.push('(No previous messages.)');
  } else {
    for (const m of ctx.conversation.messages) {
      const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
      userParts.push(`${role}: ${m.content}`);
    }
  }

  // --- USER: Current message ---
  userParts.push('\n--- Current user message ---');
  userParts.push(ctx.currentUserMessage);

  const userPrompt = userParts.join('\n\n');
  return { systemPrompt, userPrompt };
}
