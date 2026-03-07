import type { BotChatUI, BotConfig, BotLeadCaptureV2, BotLeadField, BotPersonality } from '../models/bot.schema';
import type { LeadFieldType } from '../models/bot.schema';

const LEAD_TYPES: LeadFieldType[] = ['text', 'email', 'phone', 'number', 'url'];

function slugifyKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function ensureUniqueKey(base: string, used: Set<string>): string {
  const n = slugifyKey(base) || 'field';
  if (!used.has(n)) {
    used.add(n);
    return n;
  }
  let i = 2;
  while (used.has(`${n}_${i}`)) i++;
  const k = `${n}_${i}`;
  used.add(k);
  return k;
}

function normalizeFields(input: unknown): BotLeadField[] {
  if (!Array.isArray(input)) return [];
  const used = new Set<string>();
  const out: BotLeadField[] = [];
  for (const field of input) {
    if (!field || typeof field !== 'object') continue;
    const o = field as Record<string, unknown>;
    const labelRaw = typeof o.label === 'string' ? o.label.trim() : '';
    const keyRaw = typeof o.key === 'string' ? o.key.trim() : '';
    if (!labelRaw && !keyRaw) continue;
    const typeRaw = typeof o.type === 'string' ? o.type : 'text';
    const type: LeadFieldType = LEAD_TYPES.includes(typeRaw as LeadFieldType) ? (typeRaw as LeadFieldType) : 'text';
    const key = ensureUniqueKey(keyRaw || labelRaw, used);
    out.push({
      key,
      label: labelRaw || key.replace(/_/g, ' '),
      type,
      required: o.required !== false,
    });
  }
  return out;
}

function normalizeLeadCapture(input: unknown): BotLeadCaptureV2 {
  if (!input || typeof input !== 'object') return { enabled: false, fields: [] };
  const o = input as Record<string, unknown>;
  const fields = normalizeFields(o.fields);
  const enabled = typeof o.enabled === 'boolean' ? o.enabled : fields.length > 0;
  if (fields.length > 0) return { enabled, fields };
  if ('collectName' in o || 'collectEmail' in o || 'collectPhone' in o) {
    const leg = o as { collectName?: boolean; collectEmail?: boolean; collectPhone?: boolean; enabled?: boolean };
    const legacyFields: BotLeadField[] = [];
    if (leg.collectName !== false) legacyFields.push({ key: 'name', label: 'Full name', type: 'text', required: true });
    if (leg.collectEmail !== false) legacyFields.push({ key: 'email', label: 'Email', type: 'email', required: true });
    if (leg.collectPhone) legacyFields.push({ key: 'phone', label: 'Phone', type: 'phone', required: true });
    return { enabled: leg.enabled === true, fields: legacyFields };
  }
  return { enabled: false, fields: [] };
}

function normalizeFaqs(input: unknown): Array<{ question: string; answer: string }> {
  const parsed = typeof input === 'string' ? (() => { try { return JSON.parse(input); } catch { return []; } })() : input;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item: unknown) => ({
      question: typeof (item as { question?: unknown })?.question === 'string' ? (item as { question: string }).question.trim() : '',
      answer: typeof (item as { answer?: unknown })?.answer === 'string' ? (item as { answer: string }).answer.trim() : '',
    }))
    .filter((f) => f.question && f.answer);
}

const EXAMPLE_QUESTIONS_MAX = 6;

function normalizeExampleQuestions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, EXAMPLE_QUESTIONS_MAX)
    .map((item: unknown) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

const MENU_QUICK_LINKS_MAX = 3;

function normalizeMenuQuickLinks(input: unknown): Array<{ text: string; route: string }> {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MENU_QUICK_LINKS_MAX)
    .map((item: unknown) => {
      const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
      if (!o) return null;
      const text = typeof o.text === 'string' ? o.text.trim() : '';
      const route = typeof o.route === 'string' ? o.route.trim() : '';
      return text && route ? { text, route } : null;
    })
    .filter((x): x is { text: string; route: string } => x != null);
}

export interface NormalizedBotPayload {
  name: string;
  shortDescription?: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  knowledgeDescription?: string;
  faqs: Array<{ question: string; answer: string }>;
  exampleQuestions?: string[];
  welcomeMessage?: string;
  leadCapture?: BotLeadCaptureV2;
  chatUI?: BotChatUI;
  personality?: BotPersonality;
  config?: BotConfig;
  openaiApiKeyOverride?: string;
  whisperApiKeyOverride?: string;
  isPublic: boolean;
  status?: 'draft' | 'published';
}

export function normalizeBotPayload(input: Record<string, unknown>): NormalizedBotPayload {
  const name = String(input.name ?? '').trim();
  const shortDescription = String(input.shortDescription ?? '').trim();
  const description = String(input.description ?? '').trim();
  const categories = Array.isArray(input.categories)
    ? (input.categories as unknown[]).map((e) => String(e).trim()).filter(Boolean) as string[]
    : [];
  const imageUrl = String(input.imageUrl ?? '').trim();
  const knowledgeDescription = String(input.knowledgeDescription ?? '').trim();
  const welcomeMessage = String(input.welcomeMessage ?? '').trim();
  const openaiApiKeyOverride = String(input.openaiApiKeyOverride ?? '').trim();
  const whisperApiKeyOverride = String(input.whisperApiKeyOverride ?? '').trim();
  const isPublic = input.isPublic !== false;
  const status = input.status === 'draft' || input.status === 'published' ? input.status : undefined;
  const faqs = normalizeFaqs(input.faqs);
  const exampleQuestions = normalizeExampleQuestions(input.exampleQuestions);
  const leadCapture = normalizeLeadCapture(input.leadCapture);

  const chatUIInput = (input.chatUI ?? {}) as Record<string, unknown>;
  const chatUI: BotChatUI = {
    primaryColor: typeof chatUIInput.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(chatUIInput.primaryColor.trim()) ? chatUIInput.primaryColor.trim() : '#14B8A6',
    backgroundStyle: chatUIInput.backgroundStyle === 'auto' || chatUIInput.backgroundStyle === 'light' || chatUIInput.backgroundStyle === 'dark' ? chatUIInput.backgroundStyle as BotChatUI['backgroundStyle'] : 'light',
    bubbleStyle: chatUIInput.bubbleStyle === 'rounded' || chatUIInput.bubbleStyle === 'squared' ? chatUIInput.bubbleStyle as BotChatUI['bubbleStyle'] : 'rounded',
    avatarStyle: chatUIInput.avatarStyle === 'emoji' || chatUIInput.avatarStyle === 'image' || chatUIInput.avatarStyle === 'none' ? chatUIInput.avatarStyle as BotChatUI['avatarStyle'] : 'emoji',
    launcherPosition: chatUIInput.launcherPosition === 'bottom-left' || chatUIInput.launcherPosition === 'bottom-right' ? chatUIInput.launcherPosition as BotChatUI['launcherPosition'] : 'bottom-right',
    font: chatUIInput.font === 'system' || chatUIInput.font === 'inter' || chatUIInput.font === 'poppins' ? chatUIInput.font as BotChatUI['font'] : 'inter',
    showBranding: chatUIInput.showBranding !== false,
    brandingMessage: typeof chatUIInput.brandingMessage === 'string' ? chatUIInput.brandingMessage.trim() : '',
    liveIndicatorStyle: chatUIInput.liveIndicatorStyle === 'dot-only' ? 'dot-only' : 'label',
    showMenuExpand: chatUIInput.showMenuExpand !== false,
    menuQuickLinks: normalizeMenuQuickLinks(chatUIInput.menuQuickLinks),
    showComposerWithSuggestedQuestions: chatUIInput.showComposerWithSuggestedQuestions === true,
    showAvatarInHeader: chatUIInput.showAvatarInHeader !== false,
    senderName: typeof chatUIInput.senderName === 'string' ? chatUIInput.senderName.trim() : '',
    showTime: chatUIInput.showTime !== false,
    timePosition: chatUIInput.timePosition === 'bottom-right' ? 'bottom-right' : 'top-left',
    showEmoji: chatUIInput.showEmoji !== false,
    allowFileUpload: chatUIInput.allowFileUpload === true,
    showMic: chatUIInput.showMic === true,
  };

  const BEHAVIOR_PRESETS = new Set([
    'default', 'support', 'sales', 'technical', 'marketing',
    'consultative', 'teacher', 'empathetic', 'strict',
  ]);
  const personalityInput = (input.personality ?? {}) as Record<string, unknown>;
  const personality: BotPersonality = {};
  if (typeof personalityInput.name === 'string' && personalityInput.name.trim()) personality.name = personalityInput.name.trim();
  if (typeof personalityInput.description === 'string' && personalityInput.description.trim()) personality.description = personalityInput.description.trim();
  if (typeof personalityInput.systemPrompt === 'string' && personalityInput.systemPrompt.trim()) personality.systemPrompt = personalityInput.systemPrompt.trim();
  const presetVal = String(personalityInput.behaviorPreset ?? '').trim();
  if (BEHAVIOR_PRESETS.has(presetVal)) personality.behaviorPreset = presetVal;
  if (['friendly', 'formal', 'playful', 'technical'].includes(String(personalityInput.tone))) personality.tone = personalityInput.tone as BotPersonality['tone'];
  if (typeof personalityInput.language === 'string' && personalityInput.language.trim()) personality.language = personalityInput.language.trim();
  if (typeof personalityInput.thingsToAvoid === 'string' && personalityInput.thingsToAvoid.trim()) personality.thingsToAvoid = personalityInput.thingsToAvoid.trim();
  const personalityOut = Object.keys(personality).length ? personality : undefined;

  const configInput = (input.config ?? {}) as Record<string, unknown>;
  const configCandidate: BotConfig = {};
  if (typeof configInput.temperature === 'number' && configInput.temperature >= 0 && configInput.temperature <= 1) configCandidate.temperature = configInput.temperature;
  if (typeof configInput.maxTokens === 'number' && Number.isFinite(configInput.maxTokens)) configCandidate.maxTokens = Math.max(1, Math.floor(configInput.maxTokens));
  if (['short', 'medium', 'long'].includes(String(configInput.responseLength))) configCandidate.responseLength = configInput.responseLength as BotConfig['responseLength'];
  const config = Object.keys(configCandidate).length ? configCandidate : undefined;

  return {
    name,
    shortDescription: shortDescription || undefined,
    description: description || undefined,
    categories,
    imageUrl: imageUrl || undefined,
    knowledgeDescription: knowledgeDescription || undefined,
    faqs,
    exampleQuestions: exampleQuestions.length > 0 ? exampleQuestions : undefined,
    welcomeMessage: welcomeMessage || undefined,
    leadCapture,
    chatUI,
    personality: personalityOut,
    config,
    openaiApiKeyOverride: openaiApiKeyOverride || undefined,
    whisperApiKeyOverride: whisperApiKeyOverride || undefined,
    isPublic,
    status,
  };
}
