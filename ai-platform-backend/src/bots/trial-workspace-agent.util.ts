/**
 * Validation / normalization for trial workspace PATCH bodies (visitor-own bots).
 */

import { TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS, TRIAL_MAX_FAQ_ITEMS } from '../visitors/trial-knowledge-limits';
import { coerceBehaviorPreset } from './trial-bot-from-draft-defaults.util';

const MAX_NAME = 200;
const MAX_CATEGORIES = 32;
const MAX_CATEGORY_LEN = 64;
const MAX_IMAGE_URL = 2000;
const MAX_AVATAR_EMOJI = 12;
const MAX_QUICK_LINKS = 10;
const MAX_LINK_TEXT = 80;
const MAX_LINK_ROUTE = 2000;
const MAX_SHORT_DESC = 500;
const MAX_DESCRIPTION = 4000;
const MAX_WELCOME = 2000;
const MAX_SYSTEM_PROMPT = 12_000;
const MAX_THINGS_TO_AVOID = 4_000;
const MAX_EXAMPLE_QUESTIONS = 12;
const MAX_EXAMPLE_Q_LEN = 500;

const TONES = new Set(['friendly', 'formal', 'playful', 'technical']);
const ASK_STRATEGIES = new Set(['soft', 'balanced', 'direct']);
const LEAD_FIELD_TYPES = new Set(['text', 'email', 'phone', 'number', 'url']);

function trimStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function normalizeHexColor(v: string): string {
  const s = v.trim();
  if (!s) return '#14B8A6';
  if (s.startsWith('#') && s.length >= 4) return s.slice(0, 32);
  return '#14B8A6';
}

export type TrialWorkspaceProfilePatch = {
  name?: string;
  categories?: string[];
  imageUrl?: string;
  brandColor?: string;
  quickLinks?: Array<{ text: string; route: string; icon?: string }>;
  includeNameInKnowledge?: boolean;
  avatarEmoji?: string;
};

export function parseTrialWorkspaceProfilePatch(body: unknown): TrialWorkspaceProfilePatch {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return {};
  const o = body as Record<string, unknown>;
  const out: TrialWorkspaceProfilePatch = {};

  if ('name' in o) {
    const name = trimStr(o.name, MAX_NAME);
    if (name) out.name = name;
  }
  if ('categories' in o && Array.isArray(o.categories)) {
    const cats = o.categories
      .map((c) => trimStr(c, MAX_CATEGORY_LEN))
      .filter(Boolean)
      .slice(0, MAX_CATEGORIES);
    out.categories = cats;
  }
  if ('imageUrl' in o) {
    out.imageUrl = trimStr(o.imageUrl, MAX_IMAGE_URL);
  }
  if ('brandColor' in o && typeof o.brandColor === 'string') {
    out.brandColor = normalizeHexColor(o.brandColor);
  }
  if ('quickLinks' in o && Array.isArray(o.quickLinks)) {
    const links: Array<{ text: string; route: string; icon?: string }> = [];
    for (const item of o.quickLinks) {
      if (links.length >= MAX_QUICK_LINKS) break;
      if (item == null || typeof item !== 'object') continue;
      const q = item as Record<string, unknown>;
      const text = trimStr(q.text ?? q.label, MAX_LINK_TEXT);
      const route = trimStr(q.route ?? q.url, MAX_LINK_ROUTE);
      if (!text || !route) continue;
      const icon = typeof q.icon === 'string' ? q.icon.trim().slice(0, 64) : undefined;
      links.push({ text, route, ...(icon ? { icon } : {}) });
    }
    out.quickLinks = links;
  }

  if ('includeNameInKnowledge' in o) {
    out.includeNameInKnowledge = o.includeNameInKnowledge === true;
  }
  if ('avatarEmoji' in o) {
    out.avatarEmoji =
      typeof o.avatarEmoji === 'string' ? o.avatarEmoji.trim().slice(0, MAX_AVATAR_EMOJI) : '';
  }

  return out;
}

export type TrialWorkspaceBehaviorPatch = {
  shortDescription?: string;
  description?: string;
  welcomeMessage?: string;
  exampleQuestions?: string[];
  systemPrompt?: string;
  behaviorPreset?: string;
  tone?: string;
  thingsToAvoid?: string;
  leadCapture?: {
    enabled?: boolean;
    askStrategy?: 'soft' | 'balanced' | 'direct';
    fields?: Array<{ key: string; label: string; type: string; required?: boolean }>;
  };
};

export function parseTrialWorkspaceBehaviorPatch(body: unknown): TrialWorkspaceBehaviorPatch {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return {};
  const o = body as Record<string, unknown>;
  const out: TrialWorkspaceBehaviorPatch = {};

  if ('shortDescription' in o) out.shortDescription = trimStr(o.shortDescription, MAX_SHORT_DESC);
  if ('description' in o) out.description = trimStr(o.description, MAX_DESCRIPTION);
  if ('welcomeMessage' in o) out.welcomeMessage = trimStr(o.welcomeMessage, MAX_WELCOME);
  if ('systemPrompt' in o) out.systemPrompt = trimStr(o.systemPrompt, MAX_SYSTEM_PROMPT);
  if ('thingsToAvoid' in o) out.thingsToAvoid = trimStr(o.thingsToAvoid, MAX_THINGS_TO_AVOID);

  if ('behaviorPreset' in o && typeof o.behaviorPreset === 'string') {
    const p = coerceBehaviorPreset(o.behaviorPreset);
    if (p) out.behaviorPreset = p;
  }
  if ('tone' in o && typeof o.tone === 'string') {
    const t = o.tone.trim().toLowerCase();
    if (TONES.has(t)) out.tone = t;
  }

  if ('exampleQuestions' in o && Array.isArray(o.exampleQuestions)) {
    const qs = o.exampleQuestions
      .map((x) => trimStr(x, MAX_EXAMPLE_Q_LEN))
      .filter(Boolean)
      .slice(0, MAX_EXAMPLE_QUESTIONS);
    out.exampleQuestions = qs;
  }

  if ('leadCapture' in o && o.leadCapture != null && typeof o.leadCapture === 'object' && !Array.isArray(o.leadCapture)) {
    const lc = o.leadCapture as Record<string, unknown>;
    const patch: TrialWorkspaceBehaviorPatch['leadCapture'] = {};
    if (typeof lc.enabled === 'boolean') patch.enabled = lc.enabled;
    if (typeof lc.askStrategy === 'string') {
      const a = lc.askStrategy.trim().toLowerCase();
      if (a === 'soft' || a === 'balanced' || a === 'direct') patch.askStrategy = a;
    }
    if (Array.isArray(lc.fields)) {
      const fields: Array<{ key: string; label: string; type: string; required?: boolean }> = [];
      for (const f of lc.fields) {
        if (fields.length >= 8) break;
        if (f == null || typeof f !== 'object') continue;
        const fo = f as Record<string, unknown>;
        const key = trimStr(fo.key, 64);
        const label = trimStr(fo.label, 120);
        const typeRaw = trimStr(fo.type, 32).toLowerCase() || 'text';
        const type = LEAD_FIELD_TYPES.has(typeRaw) ? typeRaw : 'text';
        if (!key || !label) continue;
        fields.push({
          key,
          label,
          type,
          required: fo.required !== false,
        });
      }
      if (fields.length) patch.fields = fields;
    }
    if (Object.keys(patch).length) out.leadCapture = patch;
  }

  return out;
}

export type TrialWorkspaceKnowledgePatch = {
  notes?: string;
  faqs?: Array<{ question: string; answer: string }>;
};

export function parseTrialWorkspaceKnowledgePatch(body: unknown): TrialWorkspaceKnowledgePatch {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return {};
  const o = body as Record<string, unknown>;
  const out: TrialWorkspaceKnowledgePatch = {};
  if ('notes' in o && typeof o.notes === 'string') {
    out.notes = o.notes.trim().slice(0, TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS);
  }
  if ('faqs' in o && Array.isArray(o.faqs)) {
    const faqs: Array<{ question: string; answer: string }> = [];
    for (const item of o.faqs) {
      if (faqs.length >= TRIAL_MAX_FAQ_ITEMS) break;
      if (item == null || typeof item !== 'object') continue;
      const q = item as Record<string, unknown>;
      const question = typeof q.question === 'string' ? q.question.trim() : '';
      const answer = typeof q.answer === 'string' ? q.answer.trim() : '';
      if (!question || !answer) continue;
      faqs.push({
        question: question.slice(0, 2000),
        answer: answer.slice(0, 8000),
      });
    }
    out.faqs = faqs;
  }
  return out;
}
