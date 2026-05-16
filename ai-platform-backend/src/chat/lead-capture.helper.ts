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

/** Whole-message tokens: not valid lead answers (name/short reply context). */
const SHORT_NON_ANSWER_TOKENS = new Set([
  'no',
  'nope',
  'yes',
  'yeah',
  'yep',
  'nah',
  'maybe',
  'later',
  'skip',
  'fine',
  'ok',
  'okay',
  'good',
  'great',
  'well',
  'thanks',
  'thank',
  'ty',
  'np',
  'hello',
  'hi',
  'hey',
  'please',
]);

/** Terms that must never be stored as a person's name (single-token or dominant token). */
const INVALID_NAME_TERMS = new Set([
  ...SHORT_NON_ANSWER_TOKENS,
  'alright',
  'help',
  'support',
  'issue',
  'problem',
  'payment',
  'pricing',
  'refund',
  'order',
  'billing',
  'urgent',
  'someone',
  'anyone',
  'nothing',
  'something',
  'user',
  'customer',
]);

const NAME_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'my',
  'our',
  'your',
  'is',
  'are',
  'was',
  'and',
  'or',
  'not',
  'it',
  'to',
  'for',
  'of',
  'in',
  'on',
  'at',
  'be',
  'am',
  'i',
  'we',
  'me',
  'us',
  'this',
  'that',
  'sure',
]);

/** Reject naive company captures (generic / support chatter). */
const INVALID_COMPANY_TERMS = new Set([
  'help',
  'support',
  'issue',
  'problem',
  'payment',
  'pricing',
  'billing',
  'refund',
  'order',
  'the',
  'a',
  'an',
  'my',
  'your',
  'our',
  'company',
  'business',
]);

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

export type LeadExtractionRejectReason =
  | 'rejected_invalid_name'
  | 'rejected_common_status_word'
  | 'rejected_low_confidence'
  | 'rejected_not_requested_field'
  | 'rejected_invalid_email'
  | 'rejected_invalid_phone'
  | 'rejected_invalid_company'
  | 'rejected_short_non_answer';

function countDigits(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

function collapseSpaces(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/** Minimum confidence to accept a newly captured field (empty slot). Stricter than overwrite threshold for some types. */
export function getMinConfidenceToCapture(fieldKey: string, fieldType?: string): number {
  const k = (fieldKey || '').toLowerCase();
  const t = (fieldType || '').toLowerCase();
  if (k === 'email' || t === 'email') return 0.97;
  if (k === 'phone' || k === 'telephone' || t === 'phone') return 0.97;
  if (k === 'name' || t === 'name') return 0.84;
  if (k === 'company' || t === 'company') return 0.8;
  if (k === 'budget' || k === 'timeline') return 0.72;
  return 0.72;
}

function tokenizeWords(s: string): string[] {
  return s
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '').toLowerCase())
    .filter(Boolean);
}

function validateNameCandidate(raw: string): boolean {
  const s = collapseSpaces(raw);
  if (s.length < 2 || s.length > 80) return false;
  if (EMAIL_REGEX.test(s)) return false;
  if (!/[A-Za-z]/.test(s)) return false;
  if (/^[\d\s.\-+()]+$/.test(s)) return false;

  const words = tokenizeWords(s);
  if (words.length === 0) return false;

  const substantive = words.filter((w) => !NAME_STOPWORDS.has(w));
  if (substantive.length === 0) return false;

  for (const w of substantive) {
    if (INVALID_NAME_TERMS.has(w)) return false;
  }

  for (const w of words) {
    if (w.length >= 2 && INVALID_NAME_TERMS.has(w)) return false;
  }

  if (substantive.length === 1 && substantive[0].length < 2) return false;

  return true;
}

function messageLooksLikeHowAreYouReply(lower: string): boolean {
  if (
    /^(i\s+am|i'm|im)\s+(fine|good|ok|okay|well|great|alright|not\s+bad)\b/.test(lower) ||
    /^(i\s+am|i'm|im)\s+doing\s+(ok|okay|fine|good|well|great|alright)\b/.test(lower)
  ) {
    return true;
  }
  if (
    /^(fine|good|ok|okay|great|well|alright)(\s*,?\s*(thanks?|thank\s+you|thx|ty))?(\s+and\s+you)?\s*!?\s*$/.test(lower)
  ) {
    return true;
  }
  if (/^(feeling\s+)?(fine|good|okay|ok|great)\s+(today|now)\s*!?\s*$/.test(lower)) return true;
  return false;
}

export function isShortLeadNonAnswerMessage(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (t.length > 64) return false;
  if (SHORT_NON_ANSWER_TOKENS.has(t)) return true;
  if (/^(thank you|thanks a lot|thanx)\s*!?\s*$/.test(t)) return true;
  if (/^(fine|good|ok|okay|great|well)\s*,\s*(thanks?|thank you)\s*!?\s*$/.test(t)) return true;
  if (/^fine\s+thanks?\s*!?\s*$/.test(t)) return true;
  return false;
}

function extractBestPhoneSegment(message: string): string | null {
  const re = new RegExp(PHONE_REGEX.source, 'g');
  let best: string | null = null;
  let bestDigits = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    const fragment = m[0].trim().replace(/\s+/g, ' ');
    const d = countDigits(fragment);
    if (d >= 7 && d <= 16 && fragment.replace(/[^\d]/g, '').length >= 7) {
      if (d > bestDigits) {
        best = fragment;
        bestDigits = d;
      }
    }
  }
  return best;
}

function validateCompanyCandidate(raw: string): boolean {
  const s = collapseSpaces(raw);
  if (s.length < 2 || s.length > 120) return false;
  const lower = s.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);
  if (tokens.every((t) => INVALID_COMPANY_TERMS.has(t) || NAME_STOPWORDS.has(t))) return false;
  if (tokens.length === 1 && INVALID_COMPANY_TERMS.has(tokens[0])) return false;
  if (!/[A-Za-z0-9]/.test(s)) return false;
  return true;
}

function tryExtractNameField(
  message: string,
  lower: string,
  trimmed: string,
  key: string,
  lastAskedField: string | undefined,
  pushReject: (reason: LeadExtractionRejectReason) => void,
): { value: string; confidence: number; match: ExtractMatchType } | null {
  const hasExplicitMyName = /\bmy\s+name\s+is\b/i.test(message);
  if (messageLooksLikeHowAreYouReply(lower) && !hasExplicitMyName) {
    pushReject('rejected_common_status_word');
    return null;
  }

  if (/\b(?:my|our)\s+(?:issue|problem|question|case)\s+is\b/i.test(lower)) {
    pushReject('rejected_invalid_name');
    return null;
  }

  const mMyName = message.match(/\bmy\s+name\s+is\s+([^.!?\n]+)/i);
  if (mMyName) {
    const cand = collapseSpaces(mMyName[1]);
    if (!validateNameCandidate(cand)) {
      pushReject('rejected_invalid_name');
      return null;
    }
    return { value: cand, confidence: 0.96, match: 'heuristic' };
  }

  const mCallMe = message.match(/\bcall\s+me\s+([^.!?\n]+)/i);
  if (mCallMe) {
    const cand = collapseSpaces(mCallMe[1]);
    if (!validateNameCandidate(cand)) {
      pushReject('rejected_invalid_name');
      return null;
    }
    return { value: cand, confidence: 0.94, match: 'heuristic' };
  }

  const mThisIs = message.match(/\bthis\s+is\s+([^.!?\n]+)/i);
  if (mThisIs) {
    const cand = collapseSpaces(mThisIs[1]);
    if (/^(urgent|important|a|an|the)\b/i.test(cand) || !validateNameCandidate(cand)) {
      pushReject('rejected_invalid_name');
      return null;
    }
    return { value: cand, confidence: 0.92, match: 'heuristic' };
  }

  const looseIm = message.match(/\b(?:i'm|i am|im)\s+([^.!?\n]+)/i);
  if (looseIm && !messageLooksLikeHowAreYouReply(lower)) {
    const cand = collapseSpaces(looseIm[1]);
    if (validateNameCandidate(cand)) {
      return { value: cand, confidence: 0.89, match: 'heuristic' };
    }
  }

  if (lastAskedField === key) {
    if (isShortLeadNonAnswerMessage(trimmed)) {
      pushReject('rejected_short_non_answer');
      return null;
    }
    const mHere = trimmed.match(/^([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,3})\s+here\.?$/);
    if (mHere && validateNameCandidate(mHere[1])) {
      return { value: collapseSpaces(mHere[1]), confidence: 0.88, match: 'heuristic' };
    }
    if (trimmed.length >= 2 && trimmed.length < 120 && !trimmed.includes('?')) {
      if (messageLooksLikeHowAreYouReply(trimmed.toLowerCase())) {
        pushReject('rejected_common_status_word');
        return null;
      }
      if (!validateNameCandidate(trimmed)) {
        pushReject('rejected_invalid_name');
        return null;
      }
      return { value: collapseSpaces(trimmed), confidence: 0.86, match: 'generic_custom' };
    }
  }

  pushReject('rejected_not_requested_field');
  return null;
}

function tryExtractCompanyField(lower: string): string | null {
  const mWork = lower.match(/(?:^|\b)(?:i\s+)?work\s+at\s+([^.!?\n]+)/);
  if (mWork) {
    const cand = collapseSpaces(mWork[1]);
    if (validateCompanyCandidate(cand)) return cand;
  }
  const mCoIs = lower.match(/\bcompany(?:\s+name)?\s+is\s+([^.!?\n]+)/);
  if (mCoIs) {
    const cand = collapseSpaces(mCoIs[1]);
    if (validateCompanyCandidate(cand)) return cand;
  }
  const mFrom = lower.match(/\bfrom\s+([^.!?\n]{2,60})\s+company\b/);
  if (mFrom) {
    const cand = collapseSpaces(mFrom[1]);
    if (validateCompanyCandidate(cand)) return cand;
  }
  return null;
}

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
  return extractLeadFieldsFromMessage(message, fieldKeys, fieldLabels, undefined).extracted;
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
  /** Fields skipped because confidence was below capture or overwrite threshold. */
  skipReasons?: Record<string, 'rejected_low_confidence'>;
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
  const skipReasons: Record<string, 'rejected_low_confidence'> = {};
  for (const [k, v] of Object.entries(extracted)) {
    const val = typeof v === 'string' ? v.trim() : '';
    if (!val) continue;
    const confidence = confidenceByField != null ? (confidenceByField[k] ?? 0.5) : 1;
    const existingVal = out[k] && String(out[k]).trim();
    if (!existingVal) {
      const minCap = getMinConfidenceToCapture(k, fieldTypes?.[k]);
      if (confidence < minCap) {
        skipped.push(k);
        skipReasons[k] = 'rejected_low_confidence';
        continue;
      }
      out[k] = val;
      continue;
    }
    const threshold = minConfidenceToOverwrite ?? getFieldOverwritePolicy(k, fieldTypes?.[k]);
    if (confidence >= threshold) {
      out[k] = val;
      overwritten.push(k);
    } else {
      skipped.push(k);
      skipReasons[k] = 'rejected_low_confidence';
    }
  }
  return {
    collected: out,
    overwritten,
    skipped,
    ...(Object.keys(skipReasons).length ? { skipReasons } : {}),
  };
}

export type ExtractMatchType = 'regex' | 'heuristic' | 'contextual' | 'generic_custom';

export interface ExtractLeadResult {
  extracted: Record<string, string>;
  confidenceByField: Record<string, number>;
  matchedByField: Record<string, ExtractMatchType>;
  /** Last extraction pass: reasons a field was not captured (debug / observability). */
  rejections?: Record<string, LeadExtractionRejectReason[]>;
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
  const rejections: Record<string, LeadExtractionRejectReason[]> = {};
  const lower = (message || '').trim().toLowerCase();
  const trimmed = (message || '').trim();
  const fieldAliases = context?.fieldAliases ?? {};
  const lastAsked = context?.lastAskedField?.trim();

  for (const key of fieldKeys) {
    const label = (fieldLabels[key] || key).toLowerCase();
    const aliases = fieldAliases[key];

    if (key === 'email' || label.includes('email')) {
      const m = message.match(EMAIL_REGEX);
      if (m) {
        const addr = m[0].trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
          const cur = rejections[key] ?? [];
          cur.push('rejected_invalid_email');
          rejections[key] = cur;
        } else {
          extracted[key] = addr;
          confidenceByField[key] = 1;
          matchedByField[key] = 'regex';
        }
      }
      continue;
    }

    if (key === 'phone' || key === 'telephone' || label.includes('phone') || label.includes('tel')) {
      const best = extractBestPhoneSegment(message);
      if (best) {
        extracted[key] = best;
        confidenceByField[key] = 1;
        matchedByField[key] = 'regex';
      } else {
        const weak = message.match(PHONE_REGEX);
        if (weak && countDigits(weak[0]) < 7) {
          const cur = rejections[key] ?? [];
          cur.push('rejected_invalid_phone');
          rejections[key] = cur;
        }
      }
      continue;
    }

    if (key === 'name' || label.includes('name')) {
      const reasons: LeadExtractionRejectReason[] = [];
      const res = tryExtractNameField(message, lower, trimmed, key, lastAsked, (r) => reasons.push(r));
      if (res) {
        extracted[key] = res.value;
        confidenceByField[key] = res.confidence;
        matchedByField[key] = res.match;
      } else if (reasons.length) {
        rejections[key] = reasons;
      }
      continue;
    }

    if (key === 'company' || label.includes('company')) {
      const co = tryExtractCompanyField(lower);
      if (co) {
        extracted[key] = co;
        confidenceByField[key] = 0.88;
        matchedByField[key] = 'heuristic';
      } else {
        const cur = rejections[key] ?? [];
        cur.push('rejected_invalid_company');
        rejections[key] = cur;
      }
      continue;
    }

    if (key === 'budget' || label.includes('budget')) {
      const budget = lower.match(/(?:budget|around|about)\s*:?\s*([^.,!?\n]+)/);
      if (budget) {
        extracted[key] = collapseSpaces(budget[1]);
        confidenceByField[key] = 0.8;
        matchedByField[key] = 'heuristic';
      }
      continue;
    }

    if (key === 'timeline' || label.includes('timeline')) {
      const tl = lower.match(/(?:timeline|by|within|next month|asap|deadline)\s*:?\s*([^.,!?\n]+)/);
      if (tl) {
        extracted[key] = collapseSpaces(tl[1]);
        confidenceByField[key] = 0.8;
        matchedByField[key] = 'heuristic';
      }
      continue;
    }

    if (key === 'requirement' || key === 'requirements' || label.includes('requirement')) {
      if (trimmed.length > 10 && trimmed.length < 500) {
        extracted[key] = trimmed;
        confidenceByField[key] = 0.7;
        matchedByField[key] = 'heuristic';
      }
      continue;
    }

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
          extracted[key] = collapseSpaces(m[1]);
          confidenceByField[key] = 0.8;
          matchedByField[key] = 'contextual';
        }
      } else if (key === 'case_type' || label.includes('case') || label.includes('type')) {
        const m = lower.match(/(?:it'?s a|case type|matter)\s*:?\s*([^.,!?\n]+)/);
        if (m) {
          extracted[key] = collapseSpaces(m[1]);
          confidenceByField[key] = 0.8;
          matchedByField[key] = 'contextual';
        }
      } else if (searchWords.some((w) => lower.includes(w))) {
        const colon = new RegExp(`(${searchWords.slice(0, 3).join('|')})\\s*:?\\s*([^.,!?\\n]+)`, 'i');
        const match = trimmed.match(colon);
        if (match) {
          const frag = match[2].trim();
          if (!isShortLeadNonAnswerMessage(frag)) {
            extracted[key] = frag;
            confidenceByField[key] = 0.78;
            matchedByField[key] = 'contextual';
          }
        }
      }
    }

    if (!extracted[key] && lastAsked === key && trimmed.length > 0 && trimmed.length < 300 && !trimmed.includes('?')) {
      if (isShortLeadNonAnswerMessage(trimmed)) {
        const cur = rejections[key] ?? [];
        cur.push('rejected_short_non_answer');
        rejections[key] = cur;
      } else {
        extracted[key] = trimmed;
        confidenceByField[key] = 0.77;
        matchedByField[key] = 'generic_custom';
      }
    }
  }

  const rejectionKeys = Object.keys(rejections);
  return {
    extracted,
    confidenceByField,
    matchedByField,
    ...(rejectionKeys.length ? { rejections } : {}),
  };
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

  if (/^(skip|nope)\s*!?\s*$/i.test(lower)) return 'declined';
  if (/^fine\s+thanks?\s*!?\s*$/i.test(lower)) return 'declined';
  if (/^(thanks?|thank you|ty)\s*!?\s*$/i.test(lower)) return 'declined';
  if (/^(fine|good|ok|okay|great|well)\s*,\s*(thanks?|thank you)\s*!?\s*$/i.test(lower)) return 'declined';

  if (POSTPONED_PHRASES.some((p) => lower.includes(p))) return 'postponed';
  if (PARTIAL_PHRASES.some((p) => lower.includes(p)) && lower.length < 80) return 'partial';
  if (DECLINE_PHRASES.some((phrase) => lower.includes(phrase))) return 'declined';

  if (/^(no|nah)\s*!?\s*$/i.test(lower)) return 'declined';
  if (/^(yes|yeah|yep)\s*!?\s*$/i.test(lower)) return 'partial';
  if (/^(fine|good|ok|okay|great|well)\s*!?\s*$/i.test(lower)) return 'declined';

  return null;
}

/**
 * When {@link detectDeclineResult} is non-null, the user is probably refusing the last lead question.
 * Do not apply freeform capture to {@link LeadCaptureMetaLike.lastAskedField}, except when the message
 * also contains extractable email/phone (other fields may still be captured).
 */
export function messageProbablyRefusesLeadQuestion(
  message: string,
  declineResult: DeclineResult | null,
): boolean {
  if (declineResult == null) return false;
  const t = (message || '').trim();
  if (EMAIL_REGEX.test(t)) return false;
  if (extractBestPhoneSegment(t)) return false;
  return true;
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
