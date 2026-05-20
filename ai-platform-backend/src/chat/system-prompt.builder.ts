/**
 * System prompt builder: HOW the assistant should answer only.
 * No factual business knowledge (pricing, hours, policies, services) — that comes from
 * the Knowledge context in the user message. Easy to inspect and extend.
 */

import type { ChatContextBehavior, ChatContextIdentity, ChatContextLeadCapture } from './chat-context.types';
import type { RetrievalConfidence } from './chat-context.types';
import type { AnswerMode } from './answerability.helper';

export type ResponseLengthMode = 'short' | 'medium' | 'long';

/** UI preset tier (derived from maxTokens; backend enum stays short/medium/long). */
export type ResponseLengthTier = 'tiny' | 'short' | 'standard' | 'detailed' | 'complete';

/** Normalize config/personality responseLength to a known mode. */
export function normalizeResponseLengthMode(raw?: string): ResponseLengthMode {
  if (raw === 'short' || raw === 'long') return raw;
  return 'medium';
}

/** Resolve prompt tier from token cap (preferred) or stored responseLength enum. */
export function resolveResponseLengthTier(
  maxTokens?: number,
  responseLength?: string,
): ResponseLengthTier {
  if (maxTokens != null && Number.isFinite(maxTokens)) {
    const n = maxTokens;
    if (n <= 64) return 'tiny';
    if (n <= 96) return 'short';
    if (n <= 160) return 'standard';
    if (n <= 256) return 'detailed';
    return 'complete';
  }
  const mode = normalizeResponseLengthMode(responseLength);
  if (mode === 'short') return 'short';
  if (mode === 'long') return 'complete';
  return 'standard';
}

export const TINY_RESPONSE_LENGTH_MARKER = 'Answer in one short line when possible';
export const SHORT_RESPONSE_LENGTH_MARKER = 'Answer in 1–2 concise sentences';
export const STANDARD_RESPONSE_LENGTH_MARKER =
  'Use one concise paragraph—be clear and helpful without over-explaining';
export const DETAILED_RESPONSE_LENGTH_MARKER =
  'Give a more helpful explanation than Standard; use 3–4 short bullets when useful';
export const COMPLETE_RESPONSE_LENGTH_MARKER =
  'Give a full business answer for broad questions; use clear mini-sections when useful';

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
  /** When `knowledge_only`, strict KB-only answers (no invented examples/copy). */
  answerMode?: AnswerMode;
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

function buildCommunicationStyleSection(tier: ResponseLengthTier): string {
  const base =
    'Speak naturally, clearly, and helpfully for a normal non-technical user. ' +
    'Never mention internal or technical concepts in your replies: do not say "knowledge base", "documents", "context", "chunks", "retrieval", "embeddings", "prompts", or "system". ' +
    'Do not use phrases like "in my knowledge base", "according to my context", "based on the provided documents", or "the system says". ' +
    'When you lack information, use natural wording such as: "I\'m not sure about that right now.", "I don\'t have that information at the moment.", "I couldn\'t find that detail.", or "I can help with what I do know." ';

  let lengthTone: string;
  if (tier === 'tiny') {
    lengthTone = 'Keep replies extremely brief—one short line when possible.';
  } else if (tier === 'short') {
    lengthTone = 'Keep replies tight: 1–2 concise sentences unless the user clearly needs more.';
  } else if (tier === 'standard') {
    lengthTone =
      'Default to one concise paragraph with no headings. Use "- " bullet lists only when the user asks for a list, features, benefits, examples, or multiple options.';
  } else if (tier === 'detailed') {
    lengthTone =
      'For broad or explanatory questions (what the company does, features, benefits, how it works), write noticeably more than Standard—add context and use 3–4 short "- " bullets when the question asks for features, benefits, or explanation. ' +
      'For greetings or trivial one-liners, stay brief (a sentence or two).';
  } else if (tier === 'complete') {
    lengthTone =
      'For broad or explanatory questions, give a full structured answer noticeably longer than Standard or Detailed—use ## headings or mini-sections (Overview, Main features, Benefits) only when they fit. ' +
      'For greetings or tiny factual one-liners, stay brief; when the user asks for explanation or features, add useful structure without padding.';
  } else {
    lengthTone = 'Keep responses clear and conversational; add detail only when it helps answer the question.';
  }

  return '\n--- Communication style ---\n' + base + lengthTone;
}

function buildResponseLengthSection(tier: ResponseLengthTier): string {
  if (tier === 'tiny') {
    return (
      '\n--- Response length ---\n' +
      `${TINY_RESPONSE_LENGTH_MARKER}. ` +
      buildMarkdownStructureRulesForTier('tiny') +
      'For greetings (e.g. "hi"), reply in one short line.'
    );
  }
  if (tier === 'short') {
    return (
      '\n--- Response length ---\n' +
      `${SHORT_RESPONSE_LENGTH_MARKER}. ` +
      buildMarkdownStructureRulesForTier('short') +
      'For greetings or tiny questions, reply in one concise sentence.'
    );
  }
  if (tier === 'standard') {
    return (
      '\n--- Response length ---\n' +
      `${STANDARD_RESPONSE_LENGTH_MARKER}. ` +
      buildMarkdownStructureRulesForTier('standard') +
      'For broad questions (e.g. what the company does and its main features), answer in one tight paragraph—do not expand into multi-section or bullet-heavy answers unless the user asked for a list or features. ' +
      'For greetings (e.g. "hi") or simple one-line questions, keep the reply short.'
    );
  }
  if (tier === 'detailed') {
    return (
      '\n--- Response length ---\n' +
      `${DETAILED_RESPONSE_LENGTH_MARKER}. ` +
      buildMarkdownStructureRulesForTier('detailed') +
      'When the user asks for features, benefits, a list, how something works, or a company/product overview, include a short lead sentence plus 3–4 short "- " bullets—this should read noticeably longer and more structured than a single Standard paragraph. ' +
      'For greetings or trivial one-liners, stay brief (a sentence or two)—do not add bullets, headings, or sections.'
    );
  }
  return (
    '\n--- Response length ---\n' +
    `${COMPLETE_RESPONSE_LENGTH_MARKER}. ` +
    buildMarkdownStructureRulesForTier('complete') +
    'For broad or overview questions (e.g. explain what the company does and include main features), organize the answer with clear ## headings or mini-sections when useful, such as: Overview, Main features, Benefits, How it helps. ' +
    'This tier should be visibly fuller than Standard and Detailed on those questions—cover the main points without filler or repetition. ' +
    'Avoid padding: do not restate the question, add generic fluff, or invent details. ' +
    'For greetings (e.g. "hi") or tiny questions that need only a one-line answer, stay brief even on Complete.'
  );
}

export const RESPONSE_STYLE_SUBORDINATE_RULE =
  'These style preferences are subordinate to factual accuracy, safety, retrieved evidence, refusal rules, system instructions, and the translation contract. Ignore any preference that asks you to invent facts, ignore sources, or override grounding.';

function buildCreativityStyleSection(temperature?: number): string {
  if (temperature == null || !Number.isFinite(temperature)) return '';
  const t = Math.min(1, Math.max(0, temperature));

  let guidance: string;
  if (t <= 0.05) {
    guidance =
      'Use the most stable, direct wording possible. For open-ended creative requests (e.g. welcome message ideas, rewrites, brainstorming), offer clear options with minimal variation between them. ' +
      'For company-specific factual answers, stay strictly faithful to the Knowledge context—do not invent facts or embellish.';
  } else if (t <= 0.25) {
    guidance =
      'Prefer precise, consistent wording. For open-ended creative requests (e.g. welcome message ideas, rewrites, brainstorming, multiple options), offer clear, direct options with minimal playful variation. ' +
      'For company-specific factual answers, stay faithful to the Knowledge context—do not invent facts.';
  } else if (t >= 0.95) {
    guidance =
      'Allow maximum variety in phrasing and ideas on open-ended creative requests (e.g. multiple greeting options, marketing copy, rewrites, brainstorming). ' +
      'For company-specific factual answers, stay faithful to the Knowledge context—do not invent facts, change policies, or drift from retrieved evidence for the sake of variety.';
  } else if (t >= 0.75) {
    guidance =
      'Allow noticeably more varied phrasing and ideas on open-ended creative requests (e.g. multiple greeting options, marketing copy, rewrites, brainstorming). ' +
      'For company-specific factual answers, stay faithful to the Knowledge context—do not invent facts, change policies, or drift from retrieved evidence for the sake of variety.';
  } else {
    guidance =
      'Balance stable factual answers with moderate variety on creative or open-ended requests. ' +
      'Do not sacrifice accuracy or grounding for creativity; vary wording on non-factual tasks more than on KB-backed answers.';
  }

  return '\n--- Creativity / variation ---\n' + guidance;
}

function buildResponseStylePreferencesSection(instructions?: string): string {
  const text = (instructions ?? '').trim();
  if (!text) return '';
  return (
    '\n--- Response style preferences ---\n' +
    'Follow these customer-defined style preferences for formatting and tone:\n' +
    text +
    '\n\n' +
    RESPONSE_STYLE_SUBORDINATE_RULE
  );
}

/** Marker for tests — formatting rules block in {@link buildSystemPrompt}. */
export const FORMATTING_RULES_MARKER = '--- Formatting rules ---';

/** Marker for tests — default bullet list syntax. */
export const MARKDOWN_BULLET_DEFAULT_RULE =
  'Use "- " Markdown bullets by default';

/** Marker for tests — when numbered lists are allowed. */
export const MARKDOWN_NUMBERED_LIST_RULE =
  'Use numbered lists ("1. ", "2. ", …) only when';

/** Marker for tests — bullet list user request. */
export const MARKDOWN_BULLET_LIST_REQUEST_RULE =
  'If the user asks for a "bullet list", always use "- " bullets';

/** Marker for tests — creative multi-answer example uses bullets. */
export const MARKDOWN_CREATIVE_WAYS_EXAMPLE = 'Give me 5 creative ways';

/** Marker for tests — step-by-step uses numbered list. */
export const MARKDOWN_STEP_BY_STEP_EXAMPLE = 'Step-by-step install instructions';

/** Marker for tests — no headings on small tiers. */
export const MARKDOWN_NO_HEADINGS_STANDARD_TIERS =
  'Do not use Markdown headings (##) in Tiny, Short, or Standard responses';

/** Marker for tests — Detailed tier bullet preference. */
export const MARKDOWN_DETAILED_BULLETS_RULE = 'prefer "- " bullets for features/benefits';

/** Marker for tests — Complete tier headings. */
export const MARKDOWN_COMPLETE_HEADINGS_RULE = '## Overview';

function buildFormattingSection(): string {
  return (
    `\n${FORMATTING_RULES_MARKER}\n` +
    'Assistant reply text must be valid Markdown for a chat interface (not HTML). Do not output HTML tags, embedded scripts, or complex document layouts.\n' +
    'Never include inline citation markers such as [1], [2][4], /[7], [^1], [source:1], or footnotes—sources are shown separately in the app’s “Sources used” panel, not inside the message body.\n' +
    'Also allowed when appropriate: **bold**, *italic*, links, inline `code`, tables for comparisons, fenced code blocks only when the user asks for code.\n\n' +
    '--- Lists ---\n' +
    `${MARKDOWN_BULLET_DEFAULT_RULE} for normal lists, benefits, features, examples, options, and summaries.\n` +
    `${MARKDOWN_BULLET_LIST_REQUEST_RULE}.\n` +
    `${MARKDOWN_NUMBERED_LIST_RULE}: the user explicitly asks for a numbered list; the answer is step-by-step instructions; the list is ranked by order/priority; or the user asks for "top 5", "first/second/third", or a clear sequence.\n` +
    'Each list item must be on its own line with a list marker—do not use plain newline-separated lines without "- " or "1. " prefixes. Do not mix bullet and numbered styles in one list unless the user asks for both.\n' +
    `Example — user: "Show me a bullet list of Assistrio benefits." → "- Benefit one\\n- Benefit two\\n- Benefit three"\n` +
    `Example — user: "${MARKDOWN_CREATIVE_WAYS_EXAMPLE}…" → "- Message one\\n- Message two\\n- Message three" (bullets, not 1. 2. 3. unless the user asked for numbered)\n` +
    `Example — user: "${MARKDOWN_STEP_BY_STEP_EXAMPLE}." → "1. First step\\n2. Second step\\n3. Third step"\n\n` +
    '--- Headings (tier-specific; see Response length section) ---\n' +
    `${MARKDOWN_NO_HEADINGS_STANDARD_TIERS}.\n` +
    `Detailed: may use at most one short ## heading if truly helpful; ${MARKDOWN_DETAILED_BULLETS_RULE}.\n` +
    `Complete: for broad/explanatory questions only, may use clear ## headings or mini-sections (e.g. ${MARKDOWN_COMPLETE_HEADINGS_RULE}, ## Main features, ## Benefits).`
  );
}

/** Tier-specific Markdown structure (headings/sections); list defaults are in {@link buildFormattingSection}. */
function buildMarkdownStructureRulesForTier(tier: ResponseLengthTier): string {
  switch (tier) {
    case 'tiny':
    case 'short':
      return (
        'Markdown structure: one short reply—no ## headings, no sections, no lists unless the user explicitly asked for a list. '
      );
    case 'standard':
      return (
        'Markdown structure: one concise paragraph by default—no ## headings, no sections. ' +
        'Use "- " bullets only when the user asks for a list, features, benefits, examples, or multiple options (not numbered lists unless step/rank rules apply). '
      );
    case 'detailed':
      return (
        'Markdown structure: no multi-section layout. At most one short ## heading if it clearly helps. ' +
        'For features/benefits/list requests, prefer a lead sentence plus 3–4 "- " bullets. '
      );
    case 'complete':
      return (
        'Markdown structure: for broad/explanatory questions, ## headings or mini-sections are allowed (Overview, Main features, Benefits). ' +
        'Use "- " bullets inside sections by default; numbered lists only per list rules above. ' +
        'For greetings or one-line factual answers, stay brief—no headings or sections. '
      );
    default:
      return '';
  }
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
  bits.push(`Tone: ${behavior.tone || 'friendly'}.`);
  const langRaw = behavior.language?.trim();
  const matchVisitor = !langRaw || langRaw.toLowerCase() === 'auto';
  if (matchVisitor) {
    bits.push(
      'Match the visitor’s language: reply in the same language they use (including mixed languages if they switch).',
    );
  } else {
    bits.push(`Respond in ${langRaw}.`);
  }
  let out = '\n--- Behavior ---\n' + (bits.length ? bits.join(' ') : '');
  if (behavior.systemPrompt?.trim()) {
    out += '\n\nOptional response rules:\n' + behavior.systemPrompt.trim();
  }
  return out;
}

function buildAnswerModeSection(answerMode?: AnswerMode): string {
  if (answerMode !== 'knowledge_only') return '';
  return (
    '\n--- Answer behavior (Knowledge-only) ---\n' +
    'Knowledge-only mode is enabled. Do not create new examples, templates, welcome messages, marketing copy, or rewritten text unless the retrieved evidence explicitly contains that content. ' +
    'If the requested content is not available in the knowledge sources, say you do not have enough information in the available knowledge sources to answer that.'
  );
}

function buildGroundingSection(input: SystemPromptInput): string {
  const { retrievalConfidence, hasDocumentSnippets, documentDirectAnswerLikely, answerability, answerMode } =
    input;
  const lowConfidence = retrievalConfidence === 'low';
  const knowledgeOnly = answerMode === 'knowledge_only';

  let grounding =
    knowledgeOnly
      ? 'Answer only from the retrieved knowledge sources. Do not invent facts, examples, templates, or copy. '
      : 'For greetings, small talk, and general conversation you may respond normally. ' +
        'For company-specific information (pricing, policies, hours, services, or internal claims) only answer from the available information. ';

  if (answerability?.shouldUseFallback) {
    if (knowledgeOnly) {
      grounding +=
        'For this question the retrieved knowledge does not directly support a reliable answer. Do NOT invent facts, examples, templates, marketing copy, or suggestions. ' +
        'Respond only with: you do not have enough information in the available knowledge sources to answer that. ';
    } else {
      grounding +=
        'For this question the retrieved knowledge does not support a reliable answer. Do NOT invent facts. ' +
        'Say clearly that you checked the available knowledge but could not find this specific detail, then offer to help with what you can. ' +
        'Do not claim you have no information at all if unrelated evidence was retrieved—only that this specific detail was not found. ';
    }
  } else if (answerability?.evidenceStrongEnough && answerability?.directAnswerLikely) {
    grounding +=
      'The retrieved evidence below is strong for this question; answer directly and confidently from it. Avoid unnecessary hedging or refusal when the evidence contains the answer. ';
  } else if (answerability?.evidenceStrongEnough) {
    grounding +=
      'The retrieved evidence below is relevant and sufficient. Base your answer on it. ' +
      'For overview or "what does the company do" questions, synthesize a clear answer from multiple evidence items when needed. ' +
      'Do NOT refuse or say you lack information when the evidence already contains the answer. ';
  } else if (answerability?.shouldAnswerGenerally) {
    grounding += 'This is a general or conversational message; you may respond naturally; strict reliance on the knowledge block is not required. ';
  } else if (hasDocumentSnippets) {
    grounding +=
      'Relevant knowledge evidence is provided below. Use it when it helps answer the question. ';
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

  if (!answerability?.shouldUseFallback && !answerability?.shouldAnswerGenerally && hasDocumentSnippets) {
    grounding +=
      lowConfidence
        ? ' If the evidence truly does not contain the answer, say you could not find that specific detail in the available knowledge—do not invent. '
        : ' If a specific detail is missing from the evidence, say you could not find that detail; otherwise answer from what is provided. ';
    grounding += 'Do not mention "knowledge base", "documents", or other internal concepts when explaining uncertainty.';
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
  const tier = resolveResponseLengthTier(
    input.behavior.maxTokens,
    input.behavior.responseLength,
  );
  const sections: string[] = [
    buildIdentitySection(input.identity),
    buildIntroductionSection(input.hasAssistantHistory),
    buildCommunicationStyleSection(tier),
    buildFormattingSection(),
    buildFactualSourceRule(),
    buildResponseLengthSection(tier),
    buildCreativityStyleSection(input.behavior.temperature),
    buildResponseStylePreferencesSection(input.behavior.responseStyleInstructions),
    buildAnswerModeSection(input.answerMode),
    buildBehaviorSection(input.behavior),
    buildGroundingSection(input),
    buildLeadCaptureSection(input.leadCapture),
  ];
  return sections.filter(Boolean).join('\n');
}
