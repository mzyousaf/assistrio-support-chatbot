/**
 * Lead capture helpers: derive state from conversation, extract fields from user text,
 * and decide when to ask for missing required fields.
 */

import type { CapturedLeadData } from '../models';
import type { ChatContextLeadCapture } from './chat-context.types';

/** Minimal lead field shape (compatible with BotLeadField from bot schema). */
interface LeadFieldLike {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  aliases?: string[];
  disabled?: boolean;
}

/** Minimal lead capture config (compatible with BotLeadCaptureV2). */
interface LeadCaptureConfigLike {
  enabled?: boolean;
  fields?: LeadFieldLike[];
}

/** Cooldown: do not ask for the same field again within this many ms. */
const LEAD_ASK_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
/** Minimum messages between asking for the same field again. */
const LEAD_ASK_MIN_MESSAGES = 3;
/** Declined: long cooldown before re-asking (user clearly refused). */
const LEAD_DECLINED_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const LEAD_DECLINED_MIN_MESSAGES = 8;
/** Postponed: shorter cooldown (user said "later", "not now"). */
const LEAD_POSTPONED_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
const LEAD_POSTPONED_MIN_MESSAGES = 4;

export interface LeadCaptureMetaLike {
  lastAskedField?: string;
  lastAskedAt?: Date;
  lastAskedMessageCount?: number;
  declinedFields?: string[];
  postponedFields?: string[];
}

/** Simple regex patterns for extracting common lead fields from free text. */
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_REGEX = /(\+\d{1,4}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}([\s.-]?\d{1,4})?/;

/** Phrases that indicate refusal to share; used for decline detection (case-insensitive). */
const DECLINE_PHRASES = [
  "don't want to share", "don't wish to share", "skip that", "skip this", "not comfortable",
  "prefer not", "rather not", "i'd rather not say", "no thanks", "decline", "pass",
  "don't have one", "won't share", "not sharing", "keep that private", "none of your business",
  "not now", "maybe later", "let's discuss later", "call me instead", "not sure yet",
  "rather not say", "skip that one", "next question", "move on",
];

/** Postponed: user defers (e.g. "maybe later", "not now") — still treat as decline for cooldown. */
const POSTPONED_PHRASES = [
  "maybe later", "not now", "later", "let's discuss later", "not sure yet", "some other time",
];

/** Partial/unclear: indirect or vague answer. */
const PARTIAL_PHRASES = ["not sure", "kind of", "it depends", "maybe", "could be"];

/**
 * Derive current lead state from stored conversation data and lead config.
 * Includes fieldAliases when config fields have aliases (for spontaneous extraction).
 */
export function getLeadStateFromConversation(
  captured: CapturedLeadData | undefined,
  leadConfig: LeadCaptureConfigLike | undefined,
): {
  collected: Record<string, string>;
  requiredFields: string[];
  optionalFields: string[];
  fieldLabels: Record<string, string>;
  fieldAliases: Record<string, string[]>;
} {
  const collected: Record<string, string> = { ...(captured || {}) };
  const requiredFields: string[] = [];
  const optionalFields: string[] = [];
  const fieldLabels: Record<string, string> = {};
  const fieldAliases: Record<string, string[]> = {};

  if (!leadConfig?.enabled || !Array.isArray(leadConfig.fields) || leadConfig.fields.length === 0) {
    return { collected, requiredFields, optionalFields, fieldLabels, fieldAliases };
  }

  for (const f of leadConfig.fields) {
    if (f.disabled) continue;
    const key = (f.key || '').trim();
    if (!key) continue;
    fieldLabels[key] = (f.label || key).trim();
    if (Array.isArray(f.aliases) && f.aliases.length > 0) {
      fieldAliases[key] = f.aliases.map((a) => String(a).trim().toLowerCase()).filter(Boolean);
    }
    if (f.required !== false) {
      requiredFields.push(key);
    } else {
      optionalFields.push(key);
    }
  }

  return { collected, requiredFields, optionalFields, fieldLabels, fieldAliases };
}

/**
 * Extract lead field values from a single user message using heuristics.
 * Used to auto-capture when user volunteers info (e.g. "my email is x@y.com").
 */
export function extractLeadFieldsFromText(
  message: string,
  fieldKeys: string[],
  fieldLabels: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const lower = message.trim().toLowerCase();

  for (const key of fieldKeys) {
    const label = (fieldLabels[key] || key).toLowerCase();
    // Email: always try regex
    if (key === 'email' || label.includes('email')) {
      const match = message.match(EMAIL_REGEX);
      if (match) out.email = match[0].trim();
    }
    // Phone
    if (key === 'phone' || key === 'telephone' || label.includes('phone') || label.includes('tel')) {
      const match = message.match(PHONE_REGEX);
      if (match) out[key] = match[0].trim().replace(/\s+/g, ' ');
    }
    // Name: "my name is X", "I'm X", "call me X"
    if (key === 'name' || label.includes('name')) {
      const myNameIs = lower.match(/(?:my name is|i'?m|call me|this is)\s+([^.,!?\n]+)/);
      if (myNameIs) out[key] = myNameIs[1].trim();
    }
    // Company: "I work at X", "company: X"
    if (key === 'company' || label.includes('company')) {
      const at = lower.match(/(?:work at|company\s*:?|at)\s+([^.,!?\n]+)/);
      if (at) out[key] = at[1].trim();
    }
  }

  return out;
}

/**
 * Build the lead-capture context for prompting: what's collected, what's missing,
 * and whether the model should ask for a missing field in this reply.
 * Avoids asking every message: only suggest asking when we have missing required
 * and optionally space it out (e.g. not every turn).
 */
export function buildLeadCaptureContext(
  collected: Record<string, string>,
  requiredFields: string[],
  optionalFields: string[],
  fieldLabels: Record<string, string>,
  options: {
    messageCountInConversation?: number;
    /** From conversation.leadCaptureMeta: last field we asked for and when. */
    meta?: LeadCaptureMetaLike;
    declinedFields?: string[];
    postponedFields?: string[];
    shouldAskThisTurn?: boolean;
    askStrategy?: 'soft' | 'balanced' | 'direct';
  },
): ChatContextLeadCapture {
  const missingRequired = requiredFields.filter((k) => !(collected[k] && String(collected[k]).trim()));
  const enabled = requiredFields.length > 0 || optionalFields.length > 0;
  const nextField = missingRequired[0];
  const meta = options.meta;
  const declined = new Set(options.declinedFields ?? meta?.declinedFields ?? []);
  const postponed = new Set(options.postponedFields ?? meta?.postponedFields ?? []);

  let shouldAskNow = enabled && missingRequired.length > 0 && (options.shouldAskThisTurn ?? true);
  if (shouldAskNow && nextField) {
    if (declined.has(nextField)) {
      const lastAt = meta?.lastAskedField === nextField && meta?.lastAskedAt ? new Date(meta.lastAskedAt).getTime() : 0;
      const elapsed = lastAt ? Date.now() - lastAt : Infinity;
      const msgCount = options.messageCountInConversation ?? 0;
      const lastMsgCount = meta?.lastAskedField === nextField ? (meta.lastAskedMessageCount ?? 0) : 0;
      if (elapsed < LEAD_DECLINED_COOLDOWN_MS || msgCount - lastMsgCount < LEAD_DECLINED_MIN_MESSAGES) {
        shouldAskNow = false;
      }
    } else if (postponed.has(nextField) && meta?.lastAskedField === nextField) {
      const lastAt = meta.lastAskedAt ? new Date(meta.lastAskedAt).getTime() : 0;
      const elapsed = Date.now() - lastAt;
      const msgCount = options.messageCountInConversation ?? 0;
      const lastMsgCount = meta.lastAskedMessageCount ?? 0;
      if (elapsed < LEAD_POSTPONED_COOLDOWN_MS || msgCount - lastMsgCount < LEAD_POSTPONED_MIN_MESSAGES) {
        shouldAskNow = false;
      }
    } else if (meta?.lastAskedField === nextField) {
      const lastAt = meta.lastAskedAt ? new Date(meta.lastAskedAt).getTime() : 0;
      const elapsed = Date.now() - lastAt;
      const msgCount = options.messageCountInConversation ?? 0;
      const lastMsgCount = meta.lastAskedMessageCount ?? 0;
      if (elapsed < LEAD_ASK_COOLDOWN_MS || msgCount - lastMsgCount < LEAD_ASK_MIN_MESSAGES) {
        shouldAskNow = false;
      }
    }
  }

  return {
    enabled,
    requiredFields,
    optionalFields,
    collected: { ...collected },
    missingRequired,
    shouldAskNow: !!shouldAskNow,
    fieldLabels: { ...fieldLabels },
    askStrategy: options.askStrategy,
  };
}

/** Result of merge with debug: final collected + overwritten/skipped keys. */
export interface MergeExtractedLeadDataResult {
  collected: Record<string, string>;
  overwritten: string[];
  skipped: string[];
}

/**
 * Merge newly extracted field values into existing collected.
 * Uses per-field overwrite policy when fieldTypes provided; otherwise single threshold.
 */
export function mergeExtractedLeadData(
  existing: Record<string, string>,
  extracted: Record<string, string>,
  confidenceByField?: Record<string, number>,
  minConfidenceToOverwrite?: number,
  fieldTypes?: Record<string, string>,
): Record<string, string> {
  const result = mergeExtractedLeadDataInternal(
    existing,
    extracted,
    confidenceByField,
    minConfidenceToOverwrite,
    fieldTypes,
  );
  return result.collected;
}

/**
 * Merge with debug info (overwritten/skipped keys). Use for admin visibility.
 */
export function mergeExtractedLeadDataWithDebug(
  existing: Record<string, string>,
  extracted: Record<string, string>,
  confidenceByField?: Record<string, number>,
  minConfidenceToOverwrite?: number,
  fieldTypes?: Record<string, string>,
): MergeExtractedLeadDataResult {
  return mergeExtractedLeadDataInternal(
    existing,
    extracted,
    confidenceByField,
    minConfidenceToOverwrite,
    fieldTypes,
  );
}

function mergeExtractedLeadDataInternal(
  existing: Record<string, string>,
  extracted: Record<string, string>,
  confidenceByField?: Record<string, number>,
  minConfidenceToOverwrite?: number,
  fieldTypes?: Record<string, string>,
): MergeExtractedLeadDataResult {
  const out = { ...existing };
  const overwritten: string[] = [];
  const skipped: string[] = [];
  for (const [k, v] of Object.entries(extracted)) {
    const val = typeof v === 'string' ? v.trim() : '';
    if (!val) continue;
    const existingVal = out[k] && String(out[k]).trim();
    if (!existingVal) {
      out[k] = val;
      continue;
    }
    const confidence = confidenceByField?.[k] ?? 0.5;
    const threshold = minConfidenceToOverwrite ?? getFieldOverwritePolicy(k, fieldTypes?.[k]);
    if (confidence >= threshold) {
      out[k] = val;
      overwritten.push(k);
    } else {
      skipped.push(k);
    }
  }
  return { collected: out, overwritten, skipped };
}

export type ExtractMatchType = 'regex' | 'heuristic' | 'contextual' | 'generic_custom';

export interface ExtractLeadResult {
  extracted: Record<string, string>;
  confidenceByField: Record<string, number>;
  matchedByField: Record<string, ExtractMatchType>;
}

/** Minimum confidence to overwrite an existing value (0–1). Default for unknown fields. */
const DEFAULT_MIN_CONFIDENCE_TO_OVERWRITE = 0.8;

/** Per-field overwrite policy: min confidence required to replace an existing value. */
export function getFieldOverwritePolicy(fieldKey: string, fieldType?: string): number {
  const k = (fieldKey || '').toLowerCase();
  const t = (fieldType || '').toLowerCase();
  if (k === 'email' || t === 'email') return 0.98;
  if (k === 'phone' || k === 'telephone' || t === 'phone') return 0.95;
  if (k === 'name') return 0.9;
  if (k === 'company') return 0.88;
  if (k === 'budget' || k === 'timeline') return 0.75;
  return DEFAULT_MIN_CONFIDENCE_TO_OVERWRITE;
}

/** Derive search words from field key, label, and optional bot-level aliases for spontaneous matching. */
function getFieldSearchWords(key: string, label: string, botAliases?: string[]): string[] {
  const k = key.toLowerCase().replace(/[-_]/g, ' ');
  const l = (label || k).toLowerCase();
  const words = new Set<string>([...k.split(/\s+/), ...l.split(/\s+/)].filter((w) => w.length > 1));
  if (Array.isArray(botAliases)) botAliases.forEach((a) => words.add(a.trim().toLowerCase()));
  const builtIn: Record<string, string[]> = {
    team_size: ['team', 'size', 'employees', 'agents', 'people', 'staff', 'headcount'],
    industry: ['industry', 'sector', 'business', 'we are in', "we're in", 'real estate', 'tech', 'software'],
    case_type: ['case', 'type', 'matter', 'inheritance', 'family', 'legal'],
    location: ['location', 'based in', 'located', 'city', 'region'],
    budget: ['budget', 'around', 'about', '$', 'usd'],
    timeline: ['timeline', 'by', 'within', 'next month', 'deadline', 'asap'],
  };
  const keyUnderscore = key.replace(/-/g, '_');
  const extra = builtIn[key] ?? builtIn[keyUnderscore];
  if (extra) extra.forEach((w) => words.add(w));
  return Array.from(words);
}

/**
 * Extract lead fields from user message with modular extractors.
 * Standard fields use regex/heuristic; custom fields use key/label/aliases for spontaneous match.
 */
export function extractLeadFieldsFromMessage(
  message: string,
  fieldKeys: string[],
  fieldLabels: Record<string, string>,
  context?: { lastAskedField?: string; fieldAliases?: Record<string, string[]> },
): ExtractLeadResult {
  const extracted: Record<string, string> = {};
  const confidenceByField: Record<string, number> = {};
  const matchedByField: Record<string, ExtractMatchType> = {};
  const lower = (message || '').trim().toLowerCase();
  const trimmed = (message || '').trim();
  const fieldAliases = context?.fieldAliases ?? {};

  for (const key of fieldKeys) {
    const label = (fieldLabels[key] || key).toLowerCase();
    const aliases = fieldAliases[key];
    if (key === 'email' || label.includes('email')) {
      const m = message.match(EMAIL_REGEX);
      if (m) {
        extracted[key] = m[0].trim();
        confidenceByField[key] = 1;
        matchedByField[key] = 'regex';
      }
    } else if (key === 'phone' || key === 'telephone' || label.includes('phone') || label.includes('tel')) {
      const m = message.match(PHONE_REGEX);
      if (m) {
        extracted[key] = m[0].trim().replace(/\s+/g, ' ');
        confidenceByField[key] = 1;
        matchedByField[key] = 'regex';
      }
    } else if (key === 'name' || label.includes('name')) {
      const myNameIs = lower.match(/(?:my name is|i'?m|call me|this is)\s+([^.,!?\n]+)/);
      if (myNameIs) {
        extracted[key] = myNameIs[1].trim();
        confidenceByField[key] = 0.9;
        matchedByField[key] = 'heuristic';
      }
    } else if (key === 'company' || label.includes('company')) {
      const at = lower.match(/(?:work at|company\s*:?|at)\s+([^.,!?\n]+)/);
      if (at) {
        extracted[key] = at[1].trim();
        confidenceByField[key] = 0.85;
        matchedByField[key] = 'heuristic';
      }
    } else if (key === 'budget' || label.includes('budget')) {
      const budget = lower.match(/(?:budget|around|about)\s*:?\s*([^.,!?\n]+)/);
      if (budget) {
        extracted[key] = budget[1].trim();
        confidenceByField[key] = 0.8;
        matchedByField[key] = 'heuristic';
      }
    } else if (key === 'timeline' || label.includes('timeline')) {
      const tl = lower.match(/(?:timeline|by|within|next month|asap|deadline)\s*:?\s*([^.,!?\n]+)/);
      if (tl) {
        extracted[key] = tl[1].trim();
        confidenceByField[key] = 0.8;
        matchedByField[key] = 'heuristic';
      }
    } else if (key === 'requirement' || key === 'requirements' || label.includes('requirement')) {
      if (trimmed.length > 10 && trimmed.length < 500) {
        extracted[key] = trimmed;
        confidenceByField[key] = 0.7;
        matchedByField[key] = 'heuristic';
      }
    } else {
      // Spontaneous custom field: match by label, bot aliases, and built-in synonyms.
      const searchWords = getFieldSearchWords(key, label, aliases);
      const hasLabelOrSynonym = searchWords.some((w) => lower.includes(w));
      if (hasLabelOrSynonym) {
        if (key === 'team_size' || label.includes('team') || label.includes('size')) {
          const m = lower.match(/(?:we have|team of|around|about|approximately)?\s*(\d+)\s*(employees|agents|people|staff|members)?/);
          if (m) {
            extracted[key] = (m[1] + (m[2] ? ' ' + m[2] : '')).trim();
            confidenceByField[key] = 0.85;
            matchedByField[key] = 'contextual';
          }
        } else if (key === 'industry' || label.includes('industry')) {
          const m = lower.match(/(?:we are (?:in|a)|industry|sector)\s*(?:is)?\s*([^.,!?\n]+)/);
          if (m) {
            extracted[key] = m[1].trim();
            confidenceByField[key] = 0.8;
            matchedByField[key] = 'contextual';
          }
        } else if (key === 'case_type' || label.includes('case') || label.includes('type')) {
          const m = lower.match(/(?:it'?s a|case type|matter)\s*:?\s*([^.,!?\n]+)/);
          if (m) {
            extracted[key] = m[1].trim();
            confidenceByField[key] = 0.8;
            matchedByField[key] = 'contextual';
          }
        } else if (searchWords.some((w) => lower.includes(w))) {
          const colon = new RegExp(`(${searchWords.slice(0, 3).join('|')})\\s*:?\\s*([^.,!?\\n]+)`, 'i');
          const match = trimmed.match(colon);
          if (match) {
            extracted[key] = match[2].trim();
            confidenceByField[key] = 0.75;
            matchedByField[key] = 'contextual';
          }
        }
      }
      if (!extracted[key] && context?.lastAskedField === key && trimmed.length > 0 && trimmed.length < 300 && !trimmed.includes('?')) {
        extracted[key] = trimmed;
        confidenceByField[key] = 0.75;
        matchedByField[key] = 'generic_custom';
      }
    }
  }

  return { extracted, confidenceByField, matchedByField };
}

/** Result of decline detection: declined, postponed, or partial/unclear. */
export type DeclineResult = 'declined' | 'postponed' | 'partial';

/**
 * Detect refusal/postpone with a richer result for logging and behavior.
 * Caller should still update declinedFields for lastAskedField so we don't re-ask soon.
 */
export function detectDeclineResult(message: string): DeclineResult | null {
  const lower = (message || '').trim().toLowerCase();
  if (lower.length > 200) return null;
  if (POSTPONED_PHRASES.some((p) => lower.includes(p))) return 'postponed';
  if (PARTIAL_PHRASES.some((p) => lower.includes(p)) && lower.length < 80) return 'partial';
  if (DECLINE_PHRASES.some((phrase) => lower.includes(phrase))) return 'declined';
  return null;
}

/**
 * Detect if the user message indicates refusal to provide info (for decline handling).
 * Works for any field; caller should pair with lastAskedField to update declinedFields.
 */
export function detectDecline(message: string): boolean {
  return detectDeclineResult(message) !== null;
}

/** Lightweight intent for lead capture: when to ask (buying → sooner, support/urgent → delay). */
export type LeadIntent = 'browsing' | 'support' | 'pricing_contact' | 'urgent' | 'buying' | 'unknown';

/**
 * Classify current turn intent for lead capture behavior (rule-based).
 * buying → ask required fields sooner; support/urgent → delay; browsing → soft.
 */
export function classifyLeadIntent(message: string): LeadIntent {
  const lower = (message || '').trim().toLowerCase();
  if (/\b(urgent|asap|emergency|critical|right now)\b/.test(lower)) return 'urgent';
  if (/\b(help|support|issue|problem|fix|broken|error|doesn't work)\b/.test(lower)) return 'support';
  if (/\b(price|pricing|cost|demo|schedule a call|contact sales|talk to someone)\b/.test(lower)) return 'pricing_contact';
  if (/\b(buy|purchase|order|sign up|get started|subscribe|ready to)\b/.test(lower)) return 'buying';
  if (/\b(just looking|browsing|exploring|curious|maybe)\b/.test(lower) || lower.length < 15) return 'browsing';
  return 'unknown';
}
