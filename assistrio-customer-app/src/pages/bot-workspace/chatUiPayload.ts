import { BOT_FIELD_MAX, clampStr } from '@/lib/botFieldLimits';
import { applyBrandingEntitlementToLocalChatUi } from '@/lib/brandingEntitlementCopy';
import { normalizePrimaryColor } from '@/lib/primaryColorNormalize';
import { normalizeQuickLinkIcon } from '@/lib/quickLinkIconNormalize';

/** Default chat UI baseline (aligned with admin bot form / Mongoose defaults). */
export const DEFAULT_CHAT_UI: Record<string, unknown> = {
  primaryColor: '#14B8A6',
  backgroundStyle: 'light',
  bubbleBorderRadius: 20,
  launcherPosition: 'bottom-right',
  shadowIntensity: 'medium',
  showChatBorder: true,
  chatPanelBorderColor: 'primary',
  chatPanelBorderWidth: 1,
  launcherIcon: 'default',
  launcherAvatarRingWidth: 18,
  launcherSize: 48,
  launcherWhenOpen: 'chevron-down',
  chatOpenAnimation: 'slide-up-fade',
  openChatOnLoad: true,
  showBranding: true,
  showAssistrioBrandingPaid: true,
  showPrivacyText: true,
  liveIndicatorStyle: 'label',
  statusIndicator: 'none',
  statusDotStyle: 'blinking',
  showScrollToBottom: true,
  showScrollToBottomLabel: true,
  scrollToBottomLabel: '',
  showScrollbar: true,
  scrollChromeStyle: 'default',
  scrollToBottomAlign: 'center',
  composerAsSeparateBox: true,
  composerBorderWidth: 1,
  composerBorderColor: 'primary',
  composerControlStyle: 'defaultDark',
  speechRecordingWaveStyle: 'default',
  showMenuExpand: true,
  showMenuQuickLinks: true,
  menuQuickLinks: [],
  showComposerWithSuggestedQuestions: false,
  hideSuggestionChipText: false,
  showAvatarInHeader: true,
  showCopyButton: true,
  showMessageFeedback: true,
  showSources: false,
  userTextBubbleStyle: 'primary',
  userVoiceBubbleStyle: 'primary',
  allowFileUpload: false,
  showMic: false,
  showVoice: false,
  brandingMessage: '',
  privacyText: '',
};

export function mergeChatUiFromBot(raw: unknown): Record<string, unknown> {
  const cur = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
  const merged = { ...DEFAULT_CHAT_UI, ...cur };
  if (!Object.prototype.hasOwnProperty.call(cur, 'showVoice')) {
    merged.showVoice = merged.showMic === true;
  }
  const scs = merged.scrollChromeStyle;
  if (scs === 'gray') {
    merged.scrollChromeStyle = 'defaultDark';
  } else if (scs !== 'default' && scs !== 'defaultDark' && scs !== 'primary') {
    merged.scrollChromeStyle = merged.scrollChromeUsesPrimary === false ? 'default' : 'primary';
  }
  const stc = merged.scrollToBottomChromeStyle;
  if (stc === 'gray') {
    merged.scrollToBottomChromeStyle = 'defaultDark';
  } else if (stc !== 'default' && stc !== 'defaultDark' && stc !== 'primary') {
    merged.scrollToBottomChromeStyle = merged.scrollChromeStyle;
  }
  const out = { ...merged } as Record<string, unknown>;
  out.brandingMessage = clampStr(String(out.brandingMessage ?? '').trim(), BOT_FIELD_MAX.brandingMessage);
  const ptx = String(out.privacyText ?? '').trim();
  out.privacyText = ptx ? clampStr(ptx, BOT_FIELD_MAX.privacyText) : '';
  out.scrollToBottomLabel = clampStr(String(out.scrollToBottomLabel ?? '').trim(), BOT_FIELD_MAX.scrollToBottomLabel);
  return out;
}

export function sanitizeMenuQuickLinksForPayload(raw: unknown): Array<{ text: string; route: string; icon?: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .slice(0, 10)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const text = String(o.text ?? '').trim();
      const route = String(o.route ?? '').trim();
      const icon = normalizeQuickLinkIcon(o.icon);
      if (!text && !route) return null;
      return {
        text: text || 'Link',
        route: route || '#',
        ...(icon ? { icon } : {}),
      };
    })
    .filter((x): x is { text: string; route: string; icon?: string } => x != null);
  return out.length ? out : undefined;
}

type ChatUiLike = Record<string, unknown>;

function normalizeComposerControlStyleForPayload(chatUI: ChatUiLike): 'brand' | 'default' | 'defaultDark' {
  const s = chatUI.composerControlStyle;
  if (s === 'brand' || s === 'default' || s === 'defaultDark') return s;
  return chatUI.composerControlsUsePrimary === false ? 'default' : 'defaultDark';
}

function normalizeSpeechRecordingWaveStyleForPayload(chatUI: ChatUiLike): 'brand' | 'default' | 'defaultDark' {
  const s = chatUI.speechRecordingWaveStyle;
  if (s === 'brand' || s === 'default' || s === 'defaultDark') return s;
  return 'default';
}

function normalizeScrollChromeStyleForPayload(chatUI: ChatUiLike): 'default' | 'defaultDark' | 'primary' {
  const s = chatUI.scrollChromeStyle;
  if (s === 'default' || s === 'defaultDark' || s === 'primary') return s;
  if (s === 'gray') return 'defaultDark';
  return chatUI.scrollChromeUsesPrimary === false ? 'default' : 'primary';
}

function normalizeScrollToBottomChromeStyleForPayload(chatUI: ChatUiLike): 'default' | 'defaultDark' | 'primary' {
  const s = chatUI.scrollToBottomChromeStyle;
  if (s === 'default' || s === 'defaultDark' || s === 'primary') return s;
  if (s === 'gray') return 'defaultDark';
  return normalizeScrollChromeStyleForPayload(chatUI);
}

function normalizeScrollToBottomAlignForPayload(chatUI: ChatUiLike): 'left' | 'center' | 'right' {
  const s = chatUI.scrollToBottomAlign;
  if (s === 'left' || s === 'right') return s;
  return 'center';
}

/** Normalized chat UI for PATCH (same rules as admin `buildChatUiPayload`). */
export function buildChatUiPayload(chatUI: ChatUiLike): ChatUiLike {
  const menuQuickLinksMenuIcon = normalizeQuickLinkIcon(chatUI.menuQuickLinksMenuIcon);
  return {
    primaryColor: normalizePrimaryColor(chatUI.primaryColor),
    backgroundStyle: chatUI.backgroundStyle || DEFAULT_CHAT_UI.backgroundStyle,
    bubbleBorderRadius: chatUI.bubbleBorderRadius ?? DEFAULT_CHAT_UI.bubbleBorderRadius,
    launcherPosition: chatUI.launcherPosition || DEFAULT_CHAT_UI.launcherPosition,
    shadowIntensity: chatUI.shadowIntensity ?? DEFAULT_CHAT_UI.shadowIntensity,
    showChatBorder: chatUI.showChatBorder ?? DEFAULT_CHAT_UI.showChatBorder,
    chatPanelBorderColor: chatUI.chatPanelBorderColor === 'default' ? 'default' : 'primary',
    chatPanelBorderWidth:
      typeof chatUI.chatPanelBorderWidth === 'number' &&
      chatUI.chatPanelBorderWidth >= 0 &&
      chatUI.chatPanelBorderWidth <= 5
        ? Math.round(chatUI.chatPanelBorderWidth)
        : DEFAULT_CHAT_UI.chatPanelBorderWidth,
    launcherIcon: chatUI.launcherIcon ?? DEFAULT_CHAT_UI.launcherIcon,
    launcherAvatarUrl:
      typeof chatUI.launcherAvatarUrl === 'string' ? chatUI.launcherAvatarUrl.trim() || undefined : undefined,
    launcherAvatarRingWidth: chatUI.launcherAvatarRingWidth ?? DEFAULT_CHAT_UI.launcherAvatarRingWidth,
    launcherSize: chatUI.launcherSize ?? DEFAULT_CHAT_UI.launcherSize,
    launcherWhenOpen:
      chatUI.launcherWhenOpen === 'close' || chatUI.launcherWhenOpen === 'same'
        ? chatUI.launcherWhenOpen
        : DEFAULT_CHAT_UI.launcherWhenOpen,
    chatOpenAnimation: chatUI.chatOpenAnimation ?? DEFAULT_CHAT_UI.chatOpenAnimation,
    openChatOnLoad: chatUI.openChatOnLoad ?? DEFAULT_CHAT_UI.openChatOnLoad,
    showBranding: chatUI.showBranding ?? DEFAULT_CHAT_UI.showBranding,
    showAssistrioBrandingPaid: chatUI.showAssistrioBrandingPaid ?? DEFAULT_CHAT_UI.showAssistrioBrandingPaid,
    brandingMessage: clampStr(
      typeof chatUI.brandingMessage === 'string' ? String(chatUI.brandingMessage).trim() : '',
      BOT_FIELD_MAX.brandingMessage,
    ),
    showPrivacyText: chatUI.showPrivacyText ?? DEFAULT_CHAT_UI.showPrivacyText,
    privacyText: (() => {
      const t = typeof chatUI.privacyText === 'string' ? chatUI.privacyText.trim() : '';
      return t ? clampStr(t, BOT_FIELD_MAX.privacyText) : undefined;
    })(),
    liveIndicatorStyle: chatUI.liveIndicatorStyle ?? DEFAULT_CHAT_UI.liveIndicatorStyle,
    statusIndicator: chatUI.statusIndicator ?? DEFAULT_CHAT_UI.statusIndicator,
    statusDotStyle: chatUI.statusDotStyle ?? DEFAULT_CHAT_UI.statusDotStyle,
    showScrollToBottom: chatUI.showScrollToBottom ?? DEFAULT_CHAT_UI.showScrollToBottom,
    showScrollToBottomLabel: chatUI.showScrollToBottomLabel ?? DEFAULT_CHAT_UI.showScrollToBottomLabel,
    scrollToBottomLabel: clampStr(
      typeof chatUI.scrollToBottomLabel === 'string' ? chatUI.scrollToBottomLabel.trim() : '',
      BOT_FIELD_MAX.scrollToBottomLabel,
    ),
    showScrollbar: chatUI.showScrollbar ?? DEFAULT_CHAT_UI.showScrollbar,
    scrollChromeStyle: normalizeScrollChromeStyleForPayload(chatUI),
    scrollToBottomChromeStyle: normalizeScrollToBottomChromeStyleForPayload(chatUI),
    scrollToBottomAlign: normalizeScrollToBottomAlignForPayload(chatUI),
    composerAsSeparateBox: chatUI.composerAsSeparateBox ?? DEFAULT_CHAT_UI.composerAsSeparateBox,
    composerBorderWidth:
      typeof chatUI.composerBorderWidth === 'number' &&
      chatUI.composerBorderWidth >= 0 &&
      chatUI.composerBorderWidth <= 6
        ? (() => {
            const w = chatUI.composerBorderWidth as number;
            return w > 0 && w < 0.5 ? 0.5 : w;
          })()
        : (chatUI as { showComposerBorder?: boolean }).showComposerBorder === false
          ? 0
          : DEFAULT_CHAT_UI.composerBorderWidth,
    composerBorderColor: chatUI.composerBorderColor ?? DEFAULT_CHAT_UI.composerBorderColor,
    composerControlStyle: normalizeComposerControlStyleForPayload(chatUI),
    speechRecordingWaveStyle: normalizeSpeechRecordingWaveStyleForPayload(chatUI),
    showMenuExpand: chatUI.showMenuExpand ?? DEFAULT_CHAT_UI.showMenuExpand,
    showMenuQuickLinks: chatUI.showMenuQuickLinks ?? DEFAULT_CHAT_UI.showMenuQuickLinks,
    menuQuickLinks: chatUI.menuQuickLinks && Array.isArray(chatUI.menuQuickLinks) && chatUI.menuQuickLinks.length
      ? chatUI.menuQuickLinks
      : undefined,
    ...(menuQuickLinksMenuIcon ? { menuQuickLinksMenuIcon } : {}),
    showComposerWithSuggestedQuestions: chatUI.showComposerWithSuggestedQuestions ?? false,
    hideSuggestionChipText: chatUI.hideSuggestionChipText === true,
    showAvatarInHeader: chatUI.showAvatarInHeader ?? DEFAULT_CHAT_UI.showAvatarInHeader,
    showCopyButton: chatUI.showCopyButton ?? DEFAULT_CHAT_UI.showCopyButton,
    showMessageFeedback: chatUI.showMessageFeedback ?? DEFAULT_CHAT_UI.showMessageFeedback,
    showSources: chatUI.showSources === true,
    userTextBubbleStyle:
      chatUI.userTextBubbleStyle === 'default'
        ? 'default'
        : chatUI.userTextBubbleStyle === 'defaultDark'
          ? 'defaultDark'
          : 'primary',
    userVoiceBubbleStyle:
      chatUI.userVoiceBubbleStyle === 'default'
        ? 'default'
        : chatUI.userVoiceBubbleStyle === 'defaultDark'
          ? 'defaultDark'
          : 'primary',
    allowFileUpload: chatUI.allowFileUpload ?? DEFAULT_CHAT_UI.allowFileUpload,
    showMic: chatUI.showMic ?? DEFAULT_CHAT_UI.showMic,
    showVoice: chatUI.showVoice ?? DEFAULT_CHAT_UI.showVoice,
  };
}

/** Sanitize quick links, then build payload for API. */
export function buildCustomerChatUiPayload(ui: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeMenuQuickLinksForPayload(ui.menuQuickLinks);
  return buildChatUiPayload({
    ...ui,
    menuQuickLinks: sanitized ?? [],
  });
}

/**
 * Keys edited from Widget Appearance (branding & theme, launcher & animation, composer styling).
 * Chat Experience owns behavior/toggles in {@link CHAT_EXPERIENCE_CHAT_UI_KEYS}; AI & Advanced owns {@link AI_ADVANCED_CHAT_UI_KEYS}.
 */
export const WIDGET_APPEARANCE_CHAT_UI_KEYS = [
  'primaryColor',
  'backgroundStyle',
  'shadowIntensity',
  'showChatBorder',
  'chatPanelBorderColor',
  'chatPanelBorderWidth',
  'bubbleBorderRadius',
  'showBranding',
  'showAssistrioBrandingPaid',
  'brandingMessage',
  'showPrivacyText',
  'privacyText',
  'launcherPosition',
  'launcherIcon',
  'launcherWhenOpen',
  'launcherSize',
  'launcherAvatarRingWidth',
  'launcherAvatarUrl',
  'chatOpenAnimation',
  'composerAsSeparateBox',
  'composerBorderWidth',
  'composerBorderColor',
  'composerControlStyle',
  'speechRecordingWaveStyle',
] as const;

/**
 * Keys edited from AI & Advanced (customer): attachments and voice/dictate in the composer.
 */
export const AI_ADVANCED_CHAT_UI_KEYS = ['allowFileUpload', 'showMic', 'showVoice'] as const;

/**
 * Keys edited from Chat Experience (tabs: Input Tools, Messages, Multiple Conversations, Header, Panel & Scrolling, Quick Links).
 * All other `chatUI` keys are owned by Widget Appearance (see {@link WIDGET_APPEARANCE_CHAT_UI_KEYS}).
 */
export const CHAT_EXPERIENCE_CHAT_UI_KEYS = [
  'showComposerWithSuggestedQuestions',
  'hideSuggestionChipText',
  'showCopyButton',
  'showMessageFeedback',
  'userTextBubbleStyle',
  'userVoiceBubbleStyle',
  'showAvatarInHeader',
  'statusIndicator',
  'liveIndicatorStyle',
  'statusDotStyle',
  'showScrollToBottom',
  'showScrollToBottomLabel',
  'scrollToBottomLabel',
  'showScrollbar',
  'scrollChromeStyle',
  'scrollToBottomChromeStyle',
  'scrollToBottomAlign',
  'showMenuExpand',
  'openChatOnLoad',
  'showMenuQuickLinks',
  'menuQuickLinks',
  'menuQuickLinksMenuIcon',
] as const;

/**
 * Merge current server `chatUI` with only Chat Experience-owned fields from local editor state,
 * then normalize for PATCH. Preserves Widget Appearance settings from `bot.chatUI`.
 */
export function buildChatExperienceChatUiSavePayload(
  botChatUi: unknown,
  localChatUi: Record<string, unknown>,
): Record<string, unknown> {
  const base = mergeChatUiFromBot(botChatUi);
  const merged: Record<string, unknown> = { ...base };
  for (const key of CHAT_EXPERIENCE_CHAT_UI_KEYS) {
    if (Object.prototype.hasOwnProperty.call(localChatUi, key)) {
      merged[key] = localChatUi[key];
    }
  }
  return buildCustomerChatUiPayload(merged);
}

/**
 * Merge `chatUI` with AI & Advanced-owned fields (attachments, mic/voice).
 */
export function buildAiAdvancedChatUiSavePayload(
  botChatUi: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base = mergeChatUiFromBot(botChatUi);
  const merged: Record<string, unknown> = { ...base };
  for (const key of AI_ADVANCED_CHAT_UI_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      merged[key] = patch[key];
    }
  }
  return buildCustomerChatUiPayload(merged);
}

/**
 * Merge server `chatUI` with only Widget Appearance-owned fields from local state, then normalize.
 * Preserves Chat Experience settings from `bot.chatUI`.
 */
export function buildWidgetAppearanceChatUiSavePayload(
  botChatUi: unknown,
  localChatUi: Record<string, unknown>,
  options?: { canRemoveBranding?: boolean },
): Record<string, unknown> {
  const base = mergeChatUiFromBot(botChatUi);
  const merged: Record<string, unknown> = { ...base };
  for (const key of WIDGET_APPEARANCE_CHAT_UI_KEYS) {
    if (Object.prototype.hasOwnProperty.call(localChatUi, key)) {
      merged[key] = localChatUi[key];
    }
  }
  const payload = buildCustomerChatUiPayload(merged);
  if (options?.canRemoveBranding === false) {
    return applyBrandingEntitlementToLocalChatUi(payload, false);
  }
  return payload;
}
