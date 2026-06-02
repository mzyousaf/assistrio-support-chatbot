import type { AllowedOrigin } from '../../bots/origin-validation.util';
import { DEFAULT_KNOWLEDGE_REPLY_PRIORITY_SETTINGS } from '../../knowledge/knowledge-reply-priority.util';
import { DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE } from '../../models/bot.schema';
import { botKnowledgeBootstrapDefaults } from './default-bot-knowledge-bootstrap.util';
import { getDefaultBotCreatePayload, type DefaultBotCreatePayload } from './default-new-bot.payload';

export const ONBOARDING_DEFAULT_PRIMARY_COLOR = '#14B8A6';

const ONBOARDING_WELCOME_MESSAGE =
  "Hi! 👋 I'm {{Name}} — {{Tagline}}. How can I help you today?";

export const ONBOARDING_BOT_CONFIG_DEFAULTS = {
  temperature: 0.5,
  maxTokens: 96,
  responseLength: 'short' as const,
  answerMode: 'knowledge_first' as const,
};

export type OnboardingBotPresetOverrides = {
  /** Hex from onboarding profile; invalid values fall back to teal default. */
  brandColor?: string;
  menuQuickLinks?: Array<{ text: string; route: string }>;
  exampleQuestions?: string[];
};

/** Normalize onboarding brand color to a 6-digit hex or the onboarding default. */
export function normalizeOnboardingBrandColor(raw?: string): string {
  const trimmed = String(raw ?? '').trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toUpperCase() : ONBOARDING_DEFAULT_PRIMARY_COLOR;
}

export function buildOnboardingChatUI(
  primaryColor: string,
  menuQuickLinks: Array<{ text: string; route: string }>,
): Record<string, unknown> {
  const showMenuQuickLinks = menuQuickLinks.length > 0;
  return {
    primaryColor,
    composerControlStyle: 'brand',
    userTextBubbleStyle: 'primary',
    userVoiceBubbleStyle: 'primary',
    launcherIcon: 'default',
    launcherPosition: 'bottom-right',
    launcherSize: 48,
    launcherWhenOpen: 'chevron-down',
    chatOpenAnimation: 'expand',
    backgroundStyle: 'light',
    bubbleBorderRadius: 20,
    shadowIntensity: 'medium',
    showChatBorder: true,
    chatPanelBorderWidth: 1,
    chatPanelBorderColor: 'default',
    composerBorderWidth: 1,
    composerBorderColor: 'default',
    showAvatarInHeader: true,
    headerStyle: 'brand',
    showSenderName: true,
    showTime: true,
    showCopyButton: true,
    showMessageFeedback: true,
    showSources: false,
    allowFileUpload: true,
    showMic: true,
    showVoice: true,
    showBranding: false,
    brandingMessage: '',
    showPrivacyText: true,
    privacyText: '',
    showComposerWithSuggestedQuestions: true,
    liveIndicatorStyle: 'dot-only',
    statusIndicator: 'live',
    statusDotStyle: 'static',
    showScrollbar: false,
    openChatOnLoad: false,
    showMenuQuickLinks,
    menuQuickLinks,
  };
}

/**
 * Stable defaults for bots created via workspace onboarding go-live.
 * Does not embed onboarding business copy or Assistrio marketing URLs.
 */
export function buildDefaultOnboardingBotPreset(
  slug: string,
  workspaceId: string,
  overrides?: OnboardingBotPresetOverrides,
): Omit<DefaultBotCreatePayload, 'clientDraftId'> & {
  clientDraftId?: undefined;
  visitorMultiChatEnabled: boolean;
  visitorMultiChatMax: number;
  includeNameInKnowledge: boolean;
  includeTaglineInKnowledge: boolean;
  includeNotesInKnowledge: boolean;
  translationSettings: {
    enabled: boolean;
    mode: 'english_only';
    transcriptLanguage: 'english';
  };
  knowledgeReplyPriority: typeof DEFAULT_KNOWLEDGE_REPLY_PRIORITY_SETTINGS;
  shareChat: { enabled: boolean };
} {
  const base = getDefaultBotCreatePayload(slug, `ws-onboarding-${workspaceId}`);
  const menuQuickLinks = overrides?.menuQuickLinks ?? [];
  const primaryColor = normalizeOnboardingBrandColor(overrides?.brandColor);

  return {
    ...base,
    clientDraftId: undefined,
    visibility: 'public',
    isPublic: false,
    shortDescription: '',
    description: '',
    categories: [],
    category: undefined,
    imageUrl: '',
    welcomeMessage: ONBOARDING_WELCOME_MESSAGE,
    welcomeMessageEnabled: true,
    exampleQuestions: overrides?.exampleQuestions ?? [],
    includeNameInKnowledge: true,
    includeTaglineInKnowledge: true,
    includeNotesInKnowledge: true,
    visitorMultiChatEnabled: true,
    visitorMultiChatMax: 5,
    leadCapture: {
      enabled: base.leadCapture.enabled,
      fields: base.leadCapture.fields.map((f) => ({ ...f })),
      askStrategy: base.leadCapture.askStrategy,
      captureMode: base.leadCapture.captureMode,
    },
    chatUI: buildOnboardingChatUI(primaryColor, menuQuickLinks),
    personality: {
      behaviorPreset: 'default',
      tone: 'friendly',
      language: 'en-US',
    },
    config: { ...ONBOARDING_BOT_CONFIG_DEFAULTS },
    widgetEmbedRateLimitPerMinute: DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE,
    translationSettings: {
      enabled: false,
      mode: 'english_only',
      transcriptLanguage: 'english',
    },
    knowledgeReplyPriority: { ...DEFAULT_KNOWLEDGE_REPLY_PRIORITY_SETTINGS },
    shareChat: { enabled: false },
    ...botKnowledgeBootstrapDefaults(),
  };
}

function normalizeWebsiteOrigin(origin: string): string | null {
  const raw = String(origin ?? '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** Default widget quick links from the first active allowed embed origin. */
export function buildOnboardingMenuQuickLinksFromAllowedOrigins(
  allowedOrigins: AllowedOrigin[],
): Array<{ text: string; route: string }> {
  const active = allowedOrigins.find((row) => row.isActive !== false && String(row.origin ?? '').trim());
  if (!active) return [];

  const base = normalizeWebsiteOrigin(String(active.origin));
  if (!base) return [];

  const links: Array<{ text: string; route: string }> = [{ text: 'Visit website', route: base }];

  return links;
}
