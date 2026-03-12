/**
 * Builds the structured chat context and formats it into the final LLM prompt.
 * System prompt = HOW to answer (behavior only). User prompt = WHAT to answer from (knowledge, history, current message).
 * When unifiedEvidence is set, a single "Retrieved Knowledge Evidence" section is used instead of notes/documents/FAQs.
 */

import type { ChatKnowledgeContext, ChatContextEvidenceItem } from './chat-context.types';
import type { ChatContextLeadCapture } from './chat-context.types';
import { buildSystemPrompt } from './system-prompt.builder';

/** Input for building the full context (from chat engine). */
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
  knowledgeNotes?: string;
  faqs?: Array<{ question: string; answer: string }>;
  documentChunks?: Array<{
    documentId: string;
    title: string;
    chunkId: string;
    text: string;
    score?: number;
    url?: string;
    sourceType?: string;
  }>;
  leadCapture: ChatContextLeadCapture;
  conversationMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  conversationSummary?: string;
  currentUserMessage: string;
  /** When 'low', grounding instructs not to invent company-specific facts. */
  retrievalConfidence?: 'high' | 'medium' | 'low';
  /** True when retrieval suggests a direct document answer; used to strengthen doc-first grounding. */
  documentDirectAnswerLikely?: boolean;
  /** When set, use evidence-first prompt (one ranked evidence block); overrides notes/documents/faqs. */
  unifiedEvidence?: ChatContextEvidenceItem[];
  /** Answerability signals (evidence path); behavior-only grounding hints. */
  answerability?: {
    evidenceStrongEnough: boolean;
    directAnswerLikely: boolean;
    shouldUseFallback: boolean;
    shouldAnswerGenerally: boolean;
  };
}

/**
 * Build the structured ChatKnowledgeContext from raw inputs.
 * Does not include conversation history in the object; that is passed separately
 * so the formatter can place it correctly in the prompt.
 */
export function buildChatKnowledgeContext(input: BuildChatContextInput): ChatKnowledgeContext {
  const notes: string[] = [];
  if (input.knowledgeNotes && input.knowledgeNotes.trim()) {
    notes.push(input.knowledgeNotes.trim());
  }

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
      notes: input.unifiedEvidence == null && notes.length > 0 ? notes : undefined,
      faqs: input.unifiedEvidence == null && input.faqs?.length ? input.faqs : undefined,
      documents: input.unifiedEvidence == null && input.documentChunks?.length ? input.documentChunks : undefined,
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
 * System = behavior only (identity, tone, formatting, safety, grounding, lead capture).
 * User = Knowledge context (notes, documents, FAQs), conversation history, current message.
 */
export function formatPromptFromContext(ctx: ChatKnowledgeContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const hasEvidence = (ctx.knowledge.unifiedEvidence?.length ?? 0) > 0;
  const hasLegacyKnowledge =
    (ctx.knowledge.notes?.length ?? 0) > 0 ||
    (ctx.knowledge.documents?.length ?? 0) > 0 ||
    (ctx.knowledge.faqs?.length ?? 0) > 0;

  const systemPrompt = buildSystemPrompt({
    identity: ctx.identity,
    behavior: ctx.behavior,
    leadCapture: ctx.leadCapture,
    retrievalConfidence: ctx.retrievalConfidence,
    hasDocumentSnippets: hasEvidence || (ctx.knowledge.documents?.length ?? 0) > 0,
    documentDirectAnswerLikely: ctx.documentDirectAnswerLikely,
    hasAssistantHistory: ctx.conversation.messages.some((m) => m.role === 'assistant'),
    answerability: ctx.answerability,
  });

  const userParts: string[] = [];

  // --- USER: Knowledge context ---
  if (hasEvidence) {
    // Evidence-first: single ranked evidence section (sourceType, title, section, text, optional URL)
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
    // Legacy: Notes, Documents, FAQs blocks
    userParts.push('--- Knowledge context ---');
    if (ctx.knowledge.notes?.length) {
      userParts.push('Notes:');
      ctx.knowledge.notes.forEach((n, i) => userParts.push(`[${i + 1}] ${n}`));
    }
    if (ctx.knowledge.documents?.length) {
      userParts.push('\nKnowledge Documents (relevant snippets):');
      ctx.knowledge.documents.forEach((d, i) => {
        const sectionMatch = (d.text || '').trim().match(/^\[([^\]]+)\]\s*\n?/);
        const section = sectionMatch ? sectionMatch[1].trim() : undefined;
        const label = section ? `${d.title} - ${section}` : d.title;
        userParts.push(`${i + 1}. [${label}]\n   ${(d.text || '').trim().replace(/\n/g, '\n   ')}`);
      });
    }
    if (ctx.knowledge.faqs?.length) {
      userParts.push('\nSupporting FAQs:');
      ctx.knowledge.faqs.forEach((f, i) => userParts.push(`Q${i + 1}: ${f.question}\nA${i + 1}: ${f.answer}`));
    }
    if (!hasLegacyKnowledge) {
      userParts.push('(No information provided. For company-specific questions say you do not have that information at the moment.)');
    }
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
