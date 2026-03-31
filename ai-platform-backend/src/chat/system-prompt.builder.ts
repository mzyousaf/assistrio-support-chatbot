/**
 * System prompt builder: HOW the assistant should answer only.
 * No factual business knowledge (pricing, hours, policies, services) — that comes from
 * the Knowledge context in the user message. Easy to inspect and extend.
 */

import type { ChatContextBehavior, ChatContextIdentity, ChatContextLeadCapture } from './chat-context.types';
import type { RetrievalConfidence } from './chat-context.types';

/** Input for building the system prompt. No knowledge content — behavior and control only. */
export interface SystemPromptInput {
  identity: ChatContextIdentity;
  behavior: ChatContextBehavior;
  leadCapture: ChatContextLeadCapture;
  /** For grounding wording: when low, stress not inventing company-specific facts. */
  retrievalConfidence?: RetrievalConfidence;
  /** True when document snippets are in the user message; affects grounding instructions. */
  hasDocumentSnippets: boolean;
  /** When true, tell the model to prefer the strong document snippet for the answer. */
  documentDirectAnswerLikely?: boolean;
  /** Whether the assistant has already replied in this conversation (for introduction behavior). */
  hasAssistantHistory: boolean;
  /** Answerability signals (evidence path): behavior-only grounding hints; no factual content. */
  answerability?: {
    evidenceStrongEnough: boolean;
    directAnswerLikely: boolean;
    shouldUseFallback: boolean;
    shouldAnswerGenerally: boolean;
  };
}

// --- Section builders (behavior-only; no company facts) ---

function buildIdentitySection(identity: ChatContextIdentity): string {
  const botName = (identity.botName || 'Assistant').trim();
  const lines: string[] = [
    `You are "${botName}". Any other assistant name in the knowledge is outdated; always identify as "${botName}".`,
  ];
  if (identity.category) lines.push(`Category: ${identity.category}.`);
  return lines.join('\n');
}

function buildIntroductionSection(hasAssistantHistory: boolean): string {
  return (
    '\n--- Introduction behavior ---\n' +
    'Introduce yourself only once at the start of a conversation when it feels natural. ' +
    (hasAssistantHistory
      ? 'You have already replied in this conversation; do not introduce yourself or repeat greetings again.'
      : 'If the user introduces themselves first, acknowledge them naturally and continue helping without repeating your own introduction.') +
    ' Do not repeat greetings or introductions in every response.'
  );
}

function buildCommunicationStyleSection(): string {
  return (
    '\n--- Communication style ---\n' +
    'Speak naturally, clearly, and helpfully for a normal non-technical user. ' +
    'Never mention internal or technical concepts in your replies: do not say "knowledge base", "documents", "context", "chunks", "retrieval", "embeddings", "prompts", or "system". ' +
    'Do not use phrases like "in my knowledge base", "according to my context", "based on the provided documents", or "the system says". ' +
    'When you lack information, use natural wording such as: "I\'m not sure about that right now.", "I don\'t have that information at the moment.", "I couldn\'t find that detail.", or "I can help with what I do know." ' +
    'Keep responses concise and conversational. Avoid long essay-style replies; break longer answers into short paragraphs or lists.'
  );
}

function buildFormattingSection(): string {
  return (
    '\n--- Formatting rules ---\n' +
    'Respond using simple Markdown suitable for a chat interface.\n' +
    'Allowed formatting: paragraphs, bullet lists, numbered lists, **bold**, *italic*, links, inline `code`, and tables when presenting structured information (e.g. pricing plans or feature lists). Use code blocks only when the user explicitly asks for code.\n' +
    'Tables should only be used when helpful for comparisons (e.g. pricing plans or feature lists).\n' +
    'Do not output HTML. Use Markdown only. Do not generate HTML.\n' +
    'Avoid: HTML, embedded scripts, complex document formatting, and unnecessary code blocks. Keep responses readable inside a chat message bubble. If sharing links, provide them as plain URLs or Markdown links. Do not generate HTML.'
  );
}

/** Explicit rule: company-specific facts come from Knowledge context only, not from system instructions or memory. */
function buildFactualSourceRule(): string {
  return (
    '\n--- Source of factual answers ---\n' +
    'Company-specific facts (e.g. pricing, hours, policies, services, refund rules, operational details) must come only from the Knowledge context provided in the user message below. ' +
    'Do not state such facts from memory or from these instructions. If the Knowledge context does not contain the answer, say you do not have that information and offer to help with what you can.'
  );
}

function buildBehaviorSection(behavior: ChatContextBehavior): string {
  const bits: string[] = [];
  if (behavior.personalityPreset) bits.push(`Preset: ${behavior.personalityPreset}.`);
  if (behavior.personalityDescription?.trim()) bits.push(behavior.personalityDescription.trim());
  if (behavior.thingsToAvoid?.trim()) bits.push(`Avoid: ${behavior.thingsToAvoid.trim()}.`);
  bits.push(`Tone: ${behavior.tone || 'friendly'}. Language: ${behavior.language || 'English'}.`);
  if (behavior.responseLength === 'short') bits.push('Keep replies short (1-2 sentences).');
  else if (behavior.responseLength === 'long') bits.push('Give detailed answers when appropriate.');
  let out = '\n--- Behavior ---\n' + (bits.length ? bits.join(' ') : '');
  if (behavior.systemPrompt?.trim()) {
    out += '\n\nOptional response rules:\n' + behavior.systemPrompt.trim();
  }
  return out;
}

function buildGroundingSection(input: SystemPromptInput): string {
  const { retrievalConfidence, hasDocumentSnippets, documentDirectAnswerLikely, answerability } = input;
  const lowConfidence = retrievalConfidence === 'low';

  let grounding =
    'For greetings, small talk, and general conversation you may respond normally. ' +
    'For company-specific information (pricing, policies, hours, services, or internal claims) only answer from the available information. ';

  if (answerability?.shouldUseFallback) {
    grounding +=
      'For this question the retrieved knowledge does not clearly support an answer. Do NOT invent facts. ' +
      'Use safe wording such as: "I couldn\'t find that in the available knowledge.", "I don\'t have enough information in the knowledge base to answer that accurately.", or "Based on what I have access to, I\'m not able to give you a definite answer on that." ' +
      'Then offer to help with what you can. ';
  } else if (answerability?.evidenceStrongEnough && answerability?.directAnswerLikely) {
    grounding +=
      'The retrieved evidence below is strong for this question; answer directly and confidently from it. Avoid unnecessary hedging. ';
  } else if (answerability?.evidenceStrongEnough) {
    grounding += 'The retrieved evidence below is sufficient; base your answer on it. ';
  } else if (answerability?.shouldAnswerGenerally) {
    grounding += 'This is a general or conversational message; you may respond naturally; strict reliance on the knowledge block is not required. ';
  }

  if (hasDocumentSnippets && !answerability) {
    grounding +=
      'When relevant document snippets are provided below, use them first for factual answers. ' +
      'If a document snippet directly answers the question, base your answer on that snippet. ' +
      'Prefer the specific document snippet over a more generic FAQ. Keep the answer faithful to the document wording when possible. ' +
      'Use FAQs as supporting guidance only—do not prefer a generic FAQ over a more specific document snippet that directly answers the question. ';
    if (documentDirectAnswerLikely) {
      grounding += 'At least one strong document snippet is present; prefer it for the answer. ';
    }
  }

  if (!answerability?.shouldUseFallback && !answerability?.shouldAnswerGenerally) {
    grounding += lowConfidence
      ? ' The available information may not cover this question. Do NOT invent company-specific details; politely say you do not have that detail right now and offer to help with what you can.'
      : ' If the available information does not contain the answer, politely say you do not have that detail right now. Do not invent company-specific facts. Do not mention "knowledge base", "documents", or other internal concepts when explaining uncertainty.';
  }

  if (input.leadCapture?.enabled) {
    grounding +=
      ' Lead capture may ask for contact or follow-up details when the Lead capture section below applies; that is separate from stating company facts and does not excuse inventing policies, prices, or capabilities from the Knowledge context.';
  }

  return '\n--- Grounding ---\n' + grounding.trim();
}

function buildLeadCaptureSection(leadCapture: ChatContextLeadCapture): string {
  if (!leadCapture.enabled) return '';

  const lc = leadCapture;
  const parts: string[] = [
    '\n--- Lead capture (works with your answers from Knowledge) ---',
    'Lead capture is ON. Behave like a normal helpful assistant: answer questions using the Knowledge context when it applies (pricing, hours, how to get help, links, etc.).',
    'Collecting contact or follow-up details is an add-on to that—not a replacement. Do not sound like a form; weave requests naturally into helpful replies.',
    'When the user shows intent such as scheduling a call, talking to a person, demos, pricing follow-up, sales, or “how do I get in touch?”, do not stop at only “use the website” or “I cannot schedule” if required contact fields below are still missing—combine your accurate answer with a short, natural request for the next missing field (e.g. email) when this turn allows asking.',
    'If Knowledge mentions contact channels (Help, Contact Us, forms), you may still cite them honestly, but prefer to offer taking their details in chat when fields are missing and asking is allowed—unless the user clearly refuses.',
  ];

  const collectedList = Object.entries(lc.collected)
    .filter(([, v]) => v && String(v).trim())
    .map(([k]) => `${k}=${lc.collected[k]}`);
  if (collectedList.length) {
    parts.push(
      `Already collected: ${collectedList.join('; ')}. Do not ask for these again; acknowledge if relevant and continue.`,
    );
  }
  if (lc.missingRequired.length) {
    const label = lc.fieldLabels[lc.missingRequired[0]] || lc.missingRequired[0];
    if (lc.shouldAskNow) {
      parts.push(
        `Next missing required field: "${label}" (key: ${lc.missingRequired[0]}). Include one concise, natural ask for this in your reply when it fits (same message as your main answer). Do not repeat the same ask if you already asked recently in the thread.`,
      );
      parts.push(
        'When asking for contact details, match the tone and style from the Behavior section above (e.g. friendly, formal, playful). Keep the ask short—typically one sentence or clause. Avoid pushy sales pressure unless the Behavior section calls for it.',
      );
    } else {
      parts.push(
        'Do not proactively ask for missing lead info in this reply (scheduling rules). Still extract anything the user volunteers in their message.',
      );
    }
  }
  parts.push(
    'Always extract lead-related values from the user message when present (email, phone, name patterns, etc.). If the user declines to share, respect that and continue helping without arguing.',
  );
  return parts.join('\n');
}

/**
 * Build the system prompt: identity, tone, formatting, safety, grounding, lead capture.
 * No factual business knowledge — that is supplied in the user message as Knowledge context.
 */
export function buildSystemPrompt(input: SystemPromptInput): string {
  const sections: string[] = [
    buildIdentitySection(input.identity),
    buildIntroductionSection(input.hasAssistantHistory),
    buildCommunicationStyleSection(),
    buildFormattingSection(),
    buildFactualSourceRule(),
    buildBehaviorSection(input.behavior),
    buildGroundingSection(input),
    buildLeadCaptureSection(input.leadCapture),
  ];
  return sections.join('\n');
}
