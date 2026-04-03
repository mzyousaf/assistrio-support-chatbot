import type { BotChatUI, BotConfig, BotLeadCaptureV2, BotLeadField, BotPersonality } from '../models/bot.schema';
import type { LeadFieldType } from '../models/bot.schema';
import {
  canonicalOriginFromString,
  isDisallowedUserEmbedHost,
  isEmbedDomainInputDisallowedLocalhost,
  parseAllowedDomainStringForStorage,
} from '../bots/embed-domain.util';
import { normalizeVisitorMultiChatMax } from '../bots/visitor-multi-chat.util';
import { normalizeQuickLinkIcon } from './quick-link-icon-ids';

const LEAD_TYPES: LeadFieldType[] = ['text', 'email', 'phone', 'number', 'url'];

function slugifyKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function ensureUniqueKey(base: string, used: Set<string>): string {
  const n = slugifyKey(base) || 'field';
  if (!used.has(n)) {
    used.add(n);
    return n;
  }
  let i = 2;
  while (used.has(`${n}-${i}`)) i++;
  const k = `${n}-${i}`;
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
    const aliases = Array.isArray(o.aliases)
      ? (o.aliases as unknown[]).map((a) => String(a).trim().toLowerCase()).filter(Boolean)
      : undefined;
    out.push({
      key,
      label: labelRaw || key.replace(/-/g, ' '),
      type,
      required: o.required !== false,
      ...(o.disabled === true ? { disabled: true } : {}),
      ...(aliases?.length ? { aliases } : {}),
    });
  }
  return out;
}

function normalizeLeadCapture(input: unknown): BotLeadCaptureV2 {
  if (!input || typeof input !== 'object') return { enabled: false, fields: [] };
  const o = input as Record<string, unknown>;
  const fields = normalizeFields(o.fields);
  const enabled = typeof o.enabled === 'boolean' ? o.enabled : fields.length > 0;
  const askStrategy = ['soft', 'balanced', 'direct'].includes(String(o.askStrategy ?? '')) ? (o.askStrategy as BotLeadCaptureV2['askStrategy']) : undefined;
  const politeMode = typeof o.politeMode === 'boolean' ? o.politeMode : undefined;
  const captureMode = ['chat', 'form', 'hybrid'].includes(String(o.captureMode ?? '')) ? (o.captureMode as BotLeadCaptureV2['captureMode']) : undefined;
  const extra = { askStrategy, politeMode, captureMode };
  if (fields.length > 0) return { enabled, fields, ...extra };
  if ('collectName' in o || 'collectEmail' in o || 'collectPhone' in o) {
    const leg = o as { collectName?: boolean; collectEmail?: boolean; collectPhone?: boolean; enabled?: boolean };
    const legacyFields: BotLeadField[] = [];
    if (leg.collectName !== false) legacyFields.push({ key: 'name', label: 'Name', type: 'text', required: true });
    if (leg.collectEmail !== false) legacyFields.push({ key: 'email', label: 'Email', type: 'email', required: true });
    if (leg.collectPhone) legacyFields.push({ key: 'phone', label: 'Phone', type: 'phone', required: true });
    return { enabled: leg.enabled === true, fields: legacyFields, ...extra };
  }
  return { enabled: false, fields: [], ...extra };
}

function normalizeFaqs(input: unknown): Array<{ question: string; answer: string; active?: boolean }> {
  const parsed = typeof input === 'string' ? (() => { try { return JSON.parse(input); } catch { return []; } })() : input;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item: unknown) => ({
      question: typeof (item as { question?: unknown })?.question === 'string' ? (item as { question: string }).question.trim() : '',
      answer: typeof (item as { answer?: unknown })?.answer === 'string' ? (item as { answer: string }).answer.trim() : '',
      active: (item as { active?: unknown })?.active === false ? false : true,
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

const MENU_QUICK_LINKS_MAX = 10;

function normalizePlatformVisitorWebsiteAllowlistFromPayload(
  input: Record<string, unknown>,
  creatorType?: 'user' | 'visitor',
): Array<{ platformVisitorId: string; websiteUrl: string }> | undefined {
  if (!('platformVisitorWebsiteAllowlist' in input)) return undefined;
  const raw = input.platformVisitorWebsiteAllowlist;
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, { platformVisitorId: string; websiteUrl: string }>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const pv = String(o.platformVisitorId ?? '').trim();
    const wuRaw = String(o.websiteUrl ?? '').trim();
    if (!pv || !wuRaw) continue;
    const canon = canonicalOriginFromString(wuRaw) ?? canonicalOriginFromString(`https://${wuRaw}`);
    if (!canon) {
      throw new Error('Invalid website URL in platform visitor allowlist.');
    }
    let host: string;
    try {
      host = new URL(canon).hostname;
    } catch {
      throw new Error('Invalid website URL in platform visitor allowlist.');
    }
    if (isDisallowedUserEmbedHost(host)) {
      throw new Error('Localhost and loopback addresses cannot be used as platform visitor website URLs.');
    }
    map.set(pv, { platformVisitorId: pv, websiteUrl: canon });
  }
  const arr = [...map.values()];
  if (creatorType === 'visitor') {
    if (arr.length > 0) {
      throw new Error('Platform visitor website URLs are not allowed on trial bots.');
    }
    return undefined;
  }
  if (arr.length > 1) {
    throw new Error('At most one platform visitor website URL is allowed per bot.');
  }
  return arr;
}

function normalizeAllowedDomainsFromPayload(
  input: Record<string, unknown>,
  creatorType?: 'user' | 'visitor',
): string[] | undefined {
  if (!('allowedDomains' in input)) return undefined;
  const raw = input.allowedDomains;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    const n = parseAllowedDomainStringForStorage(item);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    } else if (trimmed && !n && isEmbedDomainInputDisallowedLocalhost(item)) {
      throw new Error('Localhost and loopback addresses cannot be used as allowed embed domains.');
    }
  }
  if (creatorType === 'visitor' && out.length > 1) {
    throw new Error('Trial bots may have at most one allowed embed domain.');
  }
  return out;
}

function normalizeMenuQuickLinks(input: unknown): Array<{ text: string; route: string; icon?: string }> {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MENU_QUICK_LINKS_MAX)
    .map((item: unknown) => {
      const o = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
      if (!o) return null;
      const text = typeof o.text === 'string' ? o.text.trim() : '';
      const route = typeof o.route === 'string' ? o.route.trim() : '';
      if (!text || !route) return null;
      const icon = normalizeQuickLinkIcon(o.icon);
      return icon ? { text, route, icon } : { text, route };
    })
    .filter((x): x is { text: string; route: string; icon?: string } => x != null);
}

export interface NormalizedBotPayload {
  name: string;
  shortDescription?: string;
  description?: string;
  categories: string[];
  imageUrl?: string;
  avatarEmoji?: string;
  knowledgeDescription?: string;
  faqs: Array<{ question: string; answer: string; active?: boolean }>;
  exampleQuestions?: string[];
  welcomeMessage?: string;
  leadCapture?: BotLeadCaptureV2;
  chatUI?: BotChatUI;
  personality?: BotPersonality;
  config?: BotConfig;
  openaiApiKeyOverride?: string;
  whisperApiKeyOverride?: string;
  limitOverrideMessages?: number;
  visibility?: 'public' | 'private';
  messageLimitMode?: 'none' | 'fixed_total';
  messageLimitTotal?: number | null;
  messageLimitUpgradeMessage?: string | null;
  isPublic: boolean;
  status?: 'draft' | 'published';
  includeNameInKnowledge?: boolean;
  includeTaglineInKnowledge?: boolean;
  includeNotesInKnowledge: boolean;
  /** Omitted from PATCH body = leave unchanged on server. */
  allowedDomains?: string[];
  /** Per platform visitor: allowed website origin for this bot (canonical). Omitted = unchanged. */
  platformVisitorWebsiteAllowlist?: Array<{ platformVisitorId: string; websiteUrl: string }>;
  /** Present only when `visitorMultiChatEnabled` is in the request body. */
  visitorMultiChatEnabled?: boolean;
  visitorMultiChatMax?: number | null;
}

export type NormalizeBotPayloadOptions = {
  /** When set, restricts `platformVisitorWebsiteAllowlist` and `allowedDomains` for trial bots. */
  creatorType?: 'user' | 'visitor';
};

export function normalizeBotPayload(
  input: Record<string, unknown>,
  opts?: NormalizeBotPayloadOptions,
): NormalizedBotPayload {
  const platformVisitorWebsiteAllowlist = normalizePlatformVisitorWebsiteAllowlistFromPayload(
    input,
    opts?.creatorType,
  );
  const allowedDomains = normalizeAllowedDomainsFromPayload(input, opts?.creatorType);
  const name = String(input.name ?? '').trim();
  const shortDescription = String(input.shortDescription ?? '').trim();
  const description = String(input.description ?? '').trim();
  const categories = Array.isArray(input.categories)
    ? (input.categories as unknown[]).map((e) => String(e).trim()).filter(Boolean) as string[]
    : [];
  const imageUrl = String(input.imageUrl ?? '').trim();
  const avatarEmoji = String(input.avatarEmoji ?? '').trim();
  const knowledgeDescription = String(input.knowledgeDescription ?? '').trim();
  const welcomeMessage = String(input.welcomeMessage ?? '').trim();
  const openaiApiKeyOverride = String(input.openaiApiKeyOverride ?? '').trim();
  const whisperApiKeyOverride = String(input.whisperApiKeyOverride ?? '').trim();
  const limitOverrideMessages =
    typeof input.limitOverrideMessages === 'number' && Number.isFinite(input.limitOverrideMessages)
      ? Math.max(0, Math.floor(input.limitOverrideMessages))
      : undefined;
  const visibility =
    input.visibility === 'private' || input.visibility === 'public'
      ? input.visibility
      : undefined;
  const messageLimitMode =
    input.messageLimitMode === 'none' || input.messageLimitMode === 'fixed_total'
      ? input.messageLimitMode
      : undefined;
  const messageLimitTotal =
    input.messageLimitTotal == null
      ? null
      : typeof input.messageLimitTotal === 'number' && Number.isFinite(input.messageLimitTotal)
        ? Math.max(0, Math.floor(input.messageLimitTotal))
        : undefined;
  const messageLimitUpgradeMessage =
    input.messageLimitUpgradeMessage == null
      ? null
      : typeof input.messageLimitUpgradeMessage === 'string'
        ? input.messageLimitUpgradeMessage.trim() || null
        : undefined;
  const isPublic = input.isPublic !== false;
  const status = input.status === 'draft' || input.status === 'published' ? input.status : undefined;
  const includeNameInKnowledge = input.includeNameInKnowledge === true;
  const includeTaglineInKnowledge = input.includeTaglineInKnowledge === true;
  const includeNotesInKnowledge = input.includeNotesInKnowledge !== false;
  const faqs = normalizeFaqs(input.faqs);
  const exampleQuestions = normalizeExampleQuestions(input.exampleQuestions);
  const leadCapture = normalizeLeadCapture(input.leadCapture);

  const chatUIInput = (input.chatUI ?? {}) as Record<string, unknown>;
  const bubbleRadius =
    typeof chatUIInput.bubbleBorderRadius === 'number' && chatUIInput.bubbleBorderRadius >= 0 && chatUIInput.bubbleBorderRadius <= 32
      ? Math.round(chatUIInput.bubbleBorderRadius)
      : chatUIInput.bubbleStyle === 'squared'
        ? 0
        : 20;
  const timePos =
    chatUIInput.timePosition === 'bottom' || chatUIInput.timePosition === 'bottom-right' ? 'bottom' : 'top';
  const chatPanelBorderWidth =
    typeof chatUIInput.chatPanelBorderWidth === 'number' &&
      chatUIInput.chatPanelBorderWidth >= 0 &&
      chatUIInput.chatPanelBorderWidth <= 5
      ? Math.round(chatUIInput.chatPanelBorderWidth)
      : 1;
  const menuQuickLinksMenuIcon = normalizeQuickLinkIcon(chatUIInput.menuQuickLinksMenuIcon);
  const chatUI: BotChatUI = {
    primaryColor: typeof chatUIInput.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(chatUIInput.primaryColor.trim()) ? chatUIInput.primaryColor.trim() : '#14B8A6',
    backgroundStyle: chatUIInput.backgroundStyle === 'auto' || chatUIInput.backgroundStyle === 'light' || chatUIInput.backgroundStyle === 'dark' ? chatUIInput.backgroundStyle as BotChatUI['backgroundStyle'] : 'light',
    bubbleBorderRadius: bubbleRadius,
    chatPanelBorderWidth,
    launcherPosition: chatUIInput.launcherPosition === 'bottom-left' || chatUIInput.launcherPosition === 'bottom-right' ? chatUIInput.launcherPosition as BotChatUI['launcherPosition'] : 'bottom-right',
    shadowIntensity:
      chatUIInput.shadowIntensity === 'none' ||
        chatUIInput.shadowIntensity === 'low' ||
        chatUIInput.shadowIntensity === 'medium' ||
        chatUIInput.shadowIntensity === 'high'
        ? (chatUIInput.shadowIntensity as BotChatUI['shadowIntensity'])
        : 'medium',
    showChatBorder: chatUIInput.showChatBorder !== false,
    launcherIcon:
      chatUIInput.launcherIcon === 'bot-avatar' || chatUIInput.launcherIcon === 'custom' ? chatUIInput.launcherIcon : 'default',
    launcherAvatarUrl:
      typeof chatUIInput.launcherAvatarUrl === 'string' ? chatUIInput.launcherAvatarUrl.trim() || undefined : undefined,
    launcherAvatarRingWidth:
      typeof chatUIInput.launcherAvatarRingWidth === 'number' &&
        chatUIInput.launcherAvatarRingWidth >= 0 &&
        chatUIInput.launcherAvatarRingWidth <= 30
        ? Math.round(chatUIInput.launcherAvatarRingWidth)
        : 18,
    launcherSize:
      typeof chatUIInput.launcherSize === 'number' && chatUIInput.launcherSize >= 32 && chatUIInput.launcherSize <= 96
        ? Math.round(chatUIInput.launcherSize)
        : 48,
    launcherWhenOpen:
      chatUIInput.launcherWhenOpen === 'close' || chatUIInput.launcherWhenOpen === 'same'
        ? chatUIInput.launcherWhenOpen
        : 'chevron-down',
    chatOpenAnimation:
      chatUIInput.chatOpenAnimation === 'fade'
        ? 'fade'
        : chatUIInput.chatOpenAnimation === 'expand' || chatUIInput.chatOpenAnimation === 'scale'
          ? 'expand'
          : 'slide-up-fade',
    openChatOnLoad: chatUIInput.openChatOnLoad !== false,
    showBranding: chatUIInput.showBranding !== false,
    brandingMessage: typeof chatUIInput.brandingMessage === 'string' ? chatUIInput.brandingMessage.trim() : '',
    showPrivacyText: chatUIInput.showPrivacyText !== false,
    privacyText: typeof chatUIInput.privacyText === 'string' ? chatUIInput.privacyText.trim() : '',
    liveIndicatorStyle: chatUIInput.liveIndicatorStyle === 'dot-only' ? 'dot-only' : 'label',
    statusIndicator: chatUIInput.statusIndicator === 'live' || chatUIInput.statusIndicator === 'active' ? chatUIInput.statusIndicator as BotChatUI['statusIndicator'] : 'none',
    statusDotStyle: chatUIInput.statusDotStyle === 'static' ? 'static' : 'blinking',
    showScrollToBottom: chatUIInput.showScrollToBottom !== false,
    showScrollToBottomLabel: chatUIInput.showScrollToBottomLabel !== false,
    scrollToBottomLabel:
      typeof chatUIInput.scrollToBottomLabel === 'string' ? chatUIInput.scrollToBottomLabel.trim() : '',
    showScrollbar: chatUIInput.showScrollbar !== false,
    composerAsSeparateBox: chatUIInput.composerAsSeparateBox !== false,
    composerBorderWidth:
      typeof chatUIInput.composerBorderWidth === 'number' &&
        chatUIInput.composerBorderWidth >= 0 &&
        chatUIInput.composerBorderWidth <= 6
        ? (() => {
          const w = Number(chatUIInput.composerBorderWidth);
          return w > 0 && w < 0.5 ? 0.5 : Math.max(0, Math.min(6, w));
        })()
        : (chatUIInput as { showComposerBorder?: boolean }).showComposerBorder === false
          ? 0
          : 1,
    composerBorderColor: chatUIInput.composerBorderColor === 'default' ? 'default' : 'primary',
    showMenuExpand: chatUIInput.showMenuExpand !== false,
    showMenuQuickLinks: chatUIInput.showMenuQuickLinks !== false,
    menuQuickLinks: normalizeMenuQuickLinks(chatUIInput.menuQuickLinks),
    ...(menuQuickLinksMenuIcon ? { menuQuickLinksMenuIcon } : {}),
    showComposerWithSuggestedQuestions: chatUIInput.showComposerWithSuggestedQuestions === true,
    showAvatarInHeader: chatUIInput.showAvatarInHeader !== false,
    senderName: typeof chatUIInput.senderName === 'string' ? chatUIInput.senderName.trim() : '',
    showSenderName: chatUIInput.showSenderName !== false,
    showTime: chatUIInput.showTime !== false,
    showCopyButton: chatUIInput.showCopyButton !== false,
    showSources: chatUIInput.showSources !== false,
    timePosition: timePos,
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

  const visitorMultiPatch =
    'visitorMultiChatEnabled' in input
      ? (() => {
        const en = input.visitorMultiChatEnabled === true;
        const rawVisitorMax = input.visitorMultiChatMax;
        const max = !en ? null : normalizeVisitorMultiChatMax(rawVisitorMax);
        return { visitorMultiChatEnabled: en, visitorMultiChatMax: max } as const;
      })()
      : null;

  return {
    name,
    shortDescription: shortDescription || undefined,
    description: description || undefined,
    categories,
    imageUrl: imageUrl || undefined,
    avatarEmoji: avatarEmoji || undefined,
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
    limitOverrideMessages,
    visibility,
    messageLimitMode,
    messageLimitTotal,
    messageLimitUpgradeMessage,
    isPublic,
    status,
    includeNameInKnowledge,
    includeTaglineInKnowledge,
    includeNotesInKnowledge,
    ...(allowedDomains !== undefined ? { allowedDomains } : {}),
    ...(platformVisitorWebsiteAllowlist !== undefined ? { platformVisitorWebsiteAllowlist } : {}),
    ...(visitorMultiPatch ?? {}),
  };
}
