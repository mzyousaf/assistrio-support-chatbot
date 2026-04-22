import { normalizePrimaryColor } from '@/lib/primaryColorNormalize';
import { normalizeQuickLinkIcon } from '@/lib/quickLinkIconNormalize';
import {
  CHAT_UI_BRANDING_MESSAGE_MAX_LENGTH,
  CHAT_UI_PRIVACY_TEXT_MAX_LENGTH,
} from './chatUiLimits';

/** Default chat UI baseline (aligned with admin bot form / Mongoose defaults). */
export const DEFAULT_CHAT_UI: Record<string, unknown> = {
  primaryColor: '#14B8A6',
  backgroundStyle: 'light',
  bubbleBorderRadius: 20,
  launcherPosition: 'bottom-right',
  shadowIntensity: 'medium',
  showChatBorder: true,
  chatPanelBorderWidth: 1,
  launcherIcon: 'default',
  launcherAvatarRingWidth: 18,
  launcherSize: 48,
  launcherWhenOpen: 'chevron-down',
  chatOpenAnimation: 'slide-up-fade',
  openChatOnLoad: true,
  showBranding: true,
  showPrivacyText: true,
  liveIndicatorStyle: 'label',
  statusIndicator: 'none',
  statusDotStyle: 'blinking',
  showScrollToBottom: true,
  showScrollToBottomLabel: true,
  scrollToBottomLabel: '',
  showScrollbar: true,
  composerAsSeparateBox: true,
  composerBorderWidth: 1,
  composerBorderColor: 'primary',
  showMenuExpand: true,
  showMenuQuickLinks: true,
  menuQuickLinks: [],
  showComposerWithSuggestedQuestions: false,
  showAvatarInHeader: true,
  senderName: '',
  showSenderName: true,
  showTime: true,
  timePosition: 'top',
  showCopyButton: true,
  showSources: true,
  showEmoji: true,
  allowFileUpload: false,
  showMic: false,
  brandingMessage: '',
  privacyText: '',
};

export function mergeChatUiFromBot(raw: unknown): Record<string, unknown> {
  const cur = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
  return { ...DEFAULT_CHAT_UI, ...cur };
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
    brandingMessage:
      typeof chatUI.brandingMessage === 'string'
        ? chatUI.brandingMessage.slice(0, CHAT_UI_BRANDING_MESSAGE_MAX_LENGTH)
        : DEFAULT_CHAT_UI.brandingMessage,
    showPrivacyText: chatUI.showPrivacyText ?? DEFAULT_CHAT_UI.showPrivacyText,
    privacyText:
      typeof chatUI.privacyText === 'string'
        ? chatUI.privacyText.trim().slice(0, CHAT_UI_PRIVACY_TEXT_MAX_LENGTH) || undefined
        : undefined,
    liveIndicatorStyle: chatUI.liveIndicatorStyle ?? DEFAULT_CHAT_UI.liveIndicatorStyle,
    statusIndicator: chatUI.statusIndicator ?? DEFAULT_CHAT_UI.statusIndicator,
    statusDotStyle: chatUI.statusDotStyle ?? DEFAULT_CHAT_UI.statusDotStyle,
    showScrollToBottom: chatUI.showScrollToBottom ?? DEFAULT_CHAT_UI.showScrollToBottom,
    showScrollToBottomLabel: chatUI.showScrollToBottomLabel ?? DEFAULT_CHAT_UI.showScrollToBottomLabel,
    scrollToBottomLabel:
      typeof chatUI.scrollToBottomLabel === 'string' ? chatUI.scrollToBottomLabel.trim() : '',
    showScrollbar: chatUI.showScrollbar ?? DEFAULT_CHAT_UI.showScrollbar,
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
    showMenuExpand: chatUI.showMenuExpand ?? DEFAULT_CHAT_UI.showMenuExpand,
    showMenuQuickLinks: chatUI.showMenuQuickLinks ?? DEFAULT_CHAT_UI.showMenuQuickLinks,
    menuQuickLinks: chatUI.menuQuickLinks && Array.isArray(chatUI.menuQuickLinks) && chatUI.menuQuickLinks.length
      ? chatUI.menuQuickLinks
      : undefined,
    ...(menuQuickLinksMenuIcon ? { menuQuickLinksMenuIcon } : {}),
    showComposerWithSuggestedQuestions: chatUI.showComposerWithSuggestedQuestions ?? false,
    showAvatarInHeader: chatUI.showAvatarInHeader ?? DEFAULT_CHAT_UI.showAvatarInHeader,
    senderName: chatUI.senderName ?? DEFAULT_CHAT_UI.senderName,
    showSenderName: chatUI.showSenderName ?? DEFAULT_CHAT_UI.showSenderName,
    showTime: chatUI.showTime ?? DEFAULT_CHAT_UI.showTime,
    timePosition: chatUI.timePosition ?? DEFAULT_CHAT_UI.timePosition,
    showCopyButton: chatUI.showCopyButton ?? DEFAULT_CHAT_UI.showCopyButton,
    showSources: chatUI.showSources ?? DEFAULT_CHAT_UI.showSources,
    showEmoji: chatUI.showEmoji ?? DEFAULT_CHAT_UI.showEmoji,
    allowFileUpload: chatUI.allowFileUpload ?? DEFAULT_CHAT_UI.allowFileUpload,
    showMic: chatUI.showMic ?? DEFAULT_CHAT_UI.showMic,
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
 * Chat Experience owns behavior/toggles in {@link CHAT_EXPERIENCE_CHAT_UI_KEYS}.
 */
export const WIDGET_APPEARANCE_CHAT_UI_KEYS = [
  'primaryColor',
  'backgroundStyle',
  'shadowIntensity',
  'showChatBorder',
  'chatPanelBorderWidth',
  'bubbleBorderRadius',
  'showBranding',
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
] as const;

/**
 * Keys edited from Chat Experience (tabs: input tools, messages, header, controls, quick links).
 * All other `chatUI` keys are owned by Widget Appearance (see {@link WIDGET_APPEARANCE_CHAT_UI_KEYS}).
 */
export const CHAT_EXPERIENCE_CHAT_UI_KEYS = [
  'allowFileUpload',
  'showMic',
  'showEmoji',
  'showComposerWithSuggestedQuestions',
  'showCopyButton',
  'showSources',
  'showSenderName',
  'senderName',
  'showTime',
  'timePosition',
  'showAvatarInHeader',
  'statusIndicator',
  'liveIndicatorStyle',
  'statusDotStyle',
  'showScrollToBottom',
  'showScrollToBottomLabel',
  'scrollToBottomLabel',
  'showScrollbar',
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
 * Merge server `chatUI` with only Widget Appearance-owned fields from local state, then normalize.
 * Preserves Chat Experience settings from `bot.chatUI`.
 */
export function buildWidgetAppearanceChatUiSavePayload(
  botChatUi: unknown,
  localChatUi: Record<string, unknown>,
): Record<string, unknown> {
  const base = mergeChatUiFromBot(botChatUi);
  const merged: Record<string, unknown> = { ...base };
  for (const key of WIDGET_APPEARANCE_CHAT_UI_KEYS) {
    if (Object.prototype.hasOwnProperty.call(localChatUi, key)) {
      merged[key] = localChatUi[key];
    }
  }
  return buildCustomerChatUiPayload(merged);
}
