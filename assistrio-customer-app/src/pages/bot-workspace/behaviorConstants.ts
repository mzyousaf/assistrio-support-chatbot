import { BOT_FIELD_MAX, LEAD_CAPTURE_FIELDS_MAX } from '@/lib/botFieldLimits';
import {
  KB_PLAN_SUGGESTION_DESCRIPTION_MAX_UTF8_BYTES,
  KB_PLAN_SUGGESTION_TEXT_MAX_UTF8_BYTES,
} from '@/lib/knowledgeContentUtf8Limits';

/** Shown under Preset when “Default helper — uses instructions” is selected. */
export const DEFAULT_PRESET_HELPER =
  'Uses the instructions below as the main behavior instructions (no fixed role template).';

/** Aligned with admin `botFormUiConstants` / backend `BEHAVIOR_PRESET_VALUES`. */
export const BEHAVIOR_PRESETS = [
  { value: 'default', label: 'Default helper — uses instructions' },
  { value: 'support', label: 'Support agent' },
  { value: 'sales', label: 'Sales assistant' },
  { value: 'technical', label: 'Technical assistant' },
  { value: 'marketing', label: 'Marketing assistant' },
  { value: 'consultative', label: 'Consultative advisor' },
  { value: 'teacher', label: 'Teacher & explainer' },
  { value: 'empathetic', label: 'Empathetic listener' },
  { value: 'strict', label: 'Strict policy-based' },
  { value: 'concise', label: 'Concise & direct' },
  { value: 'creative', label: 'Creative & engaging' },
  { value: 'research', label: 'Research & analysis' },
  { value: 'executive', label: 'Executive assistant' },
  { value: 'hospitality', label: 'Hospitality & service' },
  { value: 'coach', label: 'Coach & mentor' },
  { value: 'analyst', label: 'Analyst & data guide' },
  { value: 'storyteller', label: 'Storytelling guide' },
  { value: 'startup', label: 'Startup voice' },
  { value: 'journalistic', label: 'Journalistic & neutral' },
  { value: 'companion', label: 'Conversational companion' },
  { value: 'simplifier', label: 'Plain-language simplifier' },
  { value: 'facilitator', label: 'Facilitator & guide' },
  { value: 'advocate', label: 'Customer advocate' },
  { value: 'negotiator', label: 'Negotiation & alignment' },
  { value: 'interviewer', label: 'Interviewer & screener' },
] as const;

/** Preset categories (value keys unique). Order: common verticals first, then additional presets. */
export const CATEGORY_OPTIONS = [
  { value: 'support', label: 'Support' },
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'hr', label: 'HR' },
  { value: 'legal', label: 'Legal' },
  { value: 'finance', label: 'Finance' },
  { value: 'operations', label: 'Operations' },
  { value: 'product', label: 'Product' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'docs', label: 'Documentation' },
  { value: 'general', label: 'General' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'customer_success', label: 'Customer Success' },
  { value: 'security', label: 'Security' },
  { value: 'devrel', label: 'Developer relations' },
  { value: 'community', label: 'Community' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'real_estate', label: 'Real estate' },
  { value: 'internal_it', label: 'Internal IT' },
  { value: 'travel', label: 'Travel' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'media', label: 'Media' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'government', label: 'Government' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'recruiting', label: 'Recruiting' },
  { value: 'events', label: 'Events' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'energy', label: 'Energy' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'food_beverage', label: 'Food & beverage' },
  { value: 'pharma', label: 'Pharmaceuticals' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'saas', label: 'SaaS' },
  { value: 'b2b', label: 'B2B' },
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'aerospace', label: 'Aerospace' },
  { value: 'construction', label: 'Construction' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'music', label: 'Music' },
  { value: 'publishing', label: 'Publishing' },
  { value: 'research', label: 'Research' },
  { value: 'sustainability', label: 'Sustainability' },
] as const;

/** Pill value for “Custom / other”; not persisted. */
export const CUSTOM_CATEGORY_PILL = '__custom__';

export const MAX_CATEGORY_PILLS = 3;

/** `personality.description` — keep in sync with `BOT_FIELD_MAX.personalityDescription`. */
export const PERSONALITY_DESCRIPTION_MAX = BOT_FIELD_MAX.personalityDescription;
export const THINGS_TO_AVOID_MAX = BOT_FIELD_MAX.thingsToAvoid;
/** First message shown in empty threads. */
export const WELCOME_MESSAGE_MAX = BOT_FIELD_MAX.welcomeMessage;

export const TONE_OPTIONS = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'warm', label: 'Warm' },
  { value: 'supportive', label: 'Supportive' },
  { value: 'empathetic', label: 'Empathetic' },
  { value: 'professional', label: 'Professional' },
  { value: 'formal', label: 'Formal' },
  { value: 'confident', label: 'Confident' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'casual', label: 'Casual' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'playful', label: 'Playful' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'diplomatic', label: 'Diplomatic' },
  { value: 'direct', label: 'Direct' },
  { value: 'patient', label: 'Patient' },
  { value: 'calm', label: 'Calm' },
  { value: 'technical', label: 'Technical' },
] as const;

/** Allowed `personality.tone` values (kept in sync with backend). */
export const VALID_TONE_VALUES = new Set<string>(TONE_OPTIONS.map((o) => o.value));

/**
 * Backend suggestion capacity (same numeric cap as backend `EXAMPLE_QUESTIONS_STORAGE_MAX`).
 * Admin workspace may use this full allowance.
 */
export const EXAMPLE_QUESTIONS_BACKEND_MAX = 10;

/** Customer app: max suggestions the user can add in Behavior + Knowledge; backend allows up to `EXAMPLE_QUESTIONS_BACKEND_MAX` (e.g. via admin). */
export const EXAMPLE_QUESTIONS_MAX = 5;

export const EXAMPLE_QUESTION_LABEL_MAX_UTF8_BYTES = KB_PLAN_SUGGESTION_TEXT_MAX_UTF8_BYTES;

/** UTF-8 byte cap for optional per-suggestion scoped context (`DEFAULT_KB_FIELD_LIMITS.suggestionDescriptionMaxBytes`). */
export const EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES = KB_PLAN_SUGGESTION_DESCRIPTION_MAX_UTF8_BYTES;

export const ASK_STRATEGY_OPTIONS = [
  { value: 'soft', label: 'Soft — ask less often' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'direct', label: 'Direct — ask sooner' },
] as const;

export const CAPTURE_MODE_OPTIONS = [
  { value: 'chat', label: 'In chat' },
  { value: 'form', label: 'Form-first' },
  { value: 'hybrid', label: 'Hybrid' },
] as const;

export const LEAD_FIELD_TYPES = ['text', 'email', 'phone', 'number', 'url'] as const;

/** Max lead fields per bot (see `LEAD_CAPTURE_FIELDS_MAX` in `botFieldLimits`). */
export const LEAD_FIELDS_MAX = LEAD_CAPTURE_FIELDS_MAX;

const PREDEFINED_SET = new Set<string>(CATEGORY_OPTIONS.map((c) => c.value));

/**
 * Maps saved `categories` to UI state.
 * - Empty → default `support`.
 * - Any non-predefined value → custom mode with text joined from those values.
 * - Only predefined → multi-select (max 3 shown).
 */
export function parseCategoriesFromBot(categories: string[]): {
  selectedPredefined: string[];
  customMode: boolean;
  customText: string;
} {
  const raw = categories.map((c) => String(c).trim()).filter(Boolean);
  if (raw.length === 0) {
    return { selectedPredefined: ['support'], customMode: false, customText: '' };
  }
  const lower = raw.map((c) => c.toLowerCase());
  const predefinedHits = lower.filter((c) => PREDEFINED_SET.has(c));
  const customVals = raw.filter((_, i) => !PREDEFINED_SET.has(lower[i]!));

  if (customVals.length > 0) {
    return {
      selectedPredefined: [],
      customMode: true,
      customText: customVals.join(', '),
    };
  }

  const uniq = [...new Set(predefinedHits)];
  const picked = uniq.slice(0, MAX_CATEGORY_PILLS);
  return {
    selectedPredefined: picked.length > 0 ? picked : ['support'],
    customMode: false,
    customText: '',
  };
}

/** Mirrors admin `presetToPrompt` for combined `personality.systemPrompt`. */
export function behaviorPresetToPrompt(preset: string) {
  switch (preset) {
    case 'support':
      return 'You are a friendly support agent. Be concise and helpful.';
    case 'sales':
      return 'You are a sales assistant. Clarify needs and propose best options.';
    case 'technical':
      return 'You are a technical assistant. Be precise and step-by-step.';
    case 'marketing':
      return 'You are a marketing assistant. Focus on messaging, positioning, and conversion clarity.';
    case 'consultative':
      return 'You are a consultative advisor. Ask clarifying questions before recommending solutions.';
    case 'teacher':
      return 'You are a patient teacher. Explain concepts clearly with practical examples.';
    case 'empathetic':
      return 'You are an empathetic assistant. Acknowledge user concerns and respond supportively.';
    case 'strict':
      return 'You are a strict assistant. Only answer if the info is clearly provided.';
    case 'concise':
      return 'You are a concise assistant. Prefer short answers; expand only when the user asks for detail.';
    case 'creative':
      return 'You are a creative assistant. Use engaging language while staying accurate and on-brand.';
    case 'research':
      return 'You are a research-oriented assistant. Cite uncertainty, compare options, and avoid speculation.';
    case 'executive':
      return 'You are an executive assistant. Be polished, structured, and respectful of the user’s time.';
    case 'hospitality':
      return 'You are a hospitality-focused assistant. Be warm, welcoming, and service-oriented.';
    case 'coach':
      return 'You are a coaching-style assistant. Ask thoughtful questions, encourage progress, and keep guidance actionable.';
    case 'analyst':
      return 'You are an analytical assistant. Prefer structured answers, clarify assumptions, and separate facts from interpretation.';
    case 'storyteller':
      return 'You are a storytelling assistant. Use clear narratives and examples while staying accurate and concise.';
    case 'startup':
      return 'You are a startup-minded assistant. Be pragmatic, fast-moving, and focused on outcomes.';
    case 'journalistic':
      return 'You are a neutral, journalistic assistant. Be clear and balanced; avoid hype and unverified claims.';
    case 'companion':
      return 'You are a conversational companion. Be natural, attentive, and easy to talk to while staying helpful and accurate.';
    case 'simplifier':
      return 'You are a plain-language simplifier. Prefer short sentences, define jargon when needed, and make complex ideas easy to follow.';
    case 'facilitator':
      return 'You are a facilitator. Keep discussions clear, offer gentle structure, summarize when helpful, and suggest practical next steps.';
    case 'advocate':
      return 'You are a customer advocate. Prioritize the user’s goals, be fair, and help them get a clear path forward.';
    case 'negotiator':
      return 'You are a negotiation-oriented assistant. Seek common ground, clarify tradeoffs, and avoid escalating conflict.';
    case 'interviewer':
      return 'You are an interviewer-style assistant. Ask focused questions one at a time, listen to answers, and adapt follow-ups.';
    default:
      return 'You are a helpful assistant.';
  }
}
