import {
  buildDefaultOnboardingBotPreset,
  buildOnboardingChatUI,
  buildOnboardingMenuQuickLinksFromAllowedOrigins,
  normalizeOnboardingBrandColor,
  ONBOARDING_BOT_CONFIG_DEFAULTS,
  ONBOARDING_DEFAULT_PRIMARY_COLOR,
} from './default-onboarding-bot.preset';
import { getDefaultBotCreatePayload } from './default-new-bot.payload';

describe('buildDefaultOnboardingBotPreset', () => {
  it('uses stable onboarding defaults without Assistrio quick links or template avatar', () => {
    const preset = buildDefaultOnboardingBotPreset('ada-bot', 'ws-123');

    expect(preset.welcomeMessage).toBe("Hi! 👋 I'm {{Name}} — {{Tagline}}. How can I help you today?");
    expect(preset.welcomeMessageEnabled).toBe(true);
    expect(preset.visitorMultiChatEnabled).toBe(true);
    expect(preset.visitorMultiChatMax).toBe(5);
    expect(preset.visibility).toBe('public');
    expect(preset.imageUrl).toBe('');
    expect(preset.exampleQuestions).toEqual([]);
    expect(preset.includeNameInKnowledge).toBe(true);
    expect(preset.includeTaglineInKnowledge).toBe(true);
    expect(preset.includeNotesInKnowledge).toBe(true);
    expect(preset.chatUI.menuQuickLinks).toEqual([]);
    expect(preset.config).toEqual(ONBOARDING_BOT_CONFIG_DEFAULTS);
    expect(preset.translationSettings).toEqual({
      enabled: false,
      mode: 'english_only',
      transcriptLanguage: 'english',
    });
    expect(preset.knowledgeReplyPriority?.mode).toBe('default');
    expect(preset.shareChat).toEqual({ enabled: false });
    expect(preset.leadCapture.enabled).toBe(true);
    expect(preset.leadCapture.fields.length).toBeGreaterThan(0);
    expect(preset.widgetEmbedRateLimitPerMinute).toBeGreaterThan(0);
  });

  it('uses explicit brand-friendly chat UI defaults with fallback primary color', () => {
    const preset = buildDefaultOnboardingBotPreset('ada-bot', 'ws-123');
    expect(preset.chatUI.primaryColor).toBe(ONBOARDING_DEFAULT_PRIMARY_COLOR);
    expect(preset.chatUI).toMatchObject({
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
      showMenuQuickLinks: false,
    });
  });

  it('sets onboarding chat UI status and composer defaults', () => {
    const preset = buildDefaultOnboardingBotPreset('ada-bot', 'ws-123');
    expect(preset.chatUI.showComposerWithSuggestedQuestions).toBe(true);
    expect(preset.chatUI.liveIndicatorStyle).toBe('dot-only');
    expect(preset.chatUI.statusIndicator).toBe('live');
    expect(preset.chatUI.statusDotStyle).toBe('static');
    expect(preset.chatUI.showScrollbar).toBe(false);
    expect(preset.chatUI.openChatOnLoad).toBe(false);
  });

  it('applies valid brand color to chatUI', () => {
    const preset = buildDefaultOnboardingBotPreset('ada-bot', 'ws-123', {
      brandColor: '#336699',
    });
    expect(preset.chatUI.primaryColor).toBe('#336699');
  });

  it('falls back to default primary color when brand color is invalid', () => {
    expect(normalizeOnboardingBrandColor('not-a-color')).toBe(ONBOARDING_DEFAULT_PRIMARY_COLOR);
    const preset = buildDefaultOnboardingBotPreset('ada-bot', 'ws-123', { brandColor: 'red' });
    expect(preset.chatUI.primaryColor).toBe(ONBOARDING_DEFAULT_PRIMARY_COLOR);
  });

  it('shows menu quick links only when origin links exist', () => {
    const links = buildOnboardingMenuQuickLinksFromAllowedOrigins([
      { origin: 'https://example.com', isActive: true },
    ]);
    const preset = buildDefaultOnboardingBotPreset('ada-bot', 'ws-123', { menuQuickLinks: links });
    expect(preset.chatUI.showMenuQuickLinks).toBe(true);
    expect(preset.chatUI.menuQuickLinks).toEqual(links);
  });

  it('does not change normal draft bot defaults', () => {
    const draft = getDefaultBotCreatePayload('draft-bot', 'client-draft');
    const quickLinks = draft.chatUI.menuQuickLinks as Array<{ route?: string }> | undefined;
    expect(quickLinks?.[0]?.route).toContain('assistrio.com');
    expect(draft.imageUrl).toContain('assistrio');
    expect(draft.config.maxTokens).toBe(160);
  });
});

describe('buildOnboardingChatUI', () => {
  it('builds chat UI from brand color and quick links', () => {
    const ui = buildOnboardingChatUI('#112233', [{ text: 'Visit website', route: 'https://example.com' }]);
    expect(ui.primaryColor).toBe('#112233');
    expect(ui.showMenuQuickLinks).toBe(true);
    expect(ui.menuQuickLinks).toHaveLength(1);
  });

  it('sets status, composer, and panel defaults explicitly', () => {
    const ui = buildOnboardingChatUI('#112233', []);
    expect(ui.showBranding).toBe(false);
    expect(ui.brandingMessage).toBe('');
    expect(ui.showPrivacyText).toBe(true);
    expect(ui.privacyText).toBe('');
    expect(ui.showComposerWithSuggestedQuestions).toBe(true);
    expect(ui.liveIndicatorStyle).toBe('dot-only');
    expect(ui.statusIndicator).toBe('live');
    expect(ui.statusDotStyle).toBe('static');
    expect(ui.showScrollbar).toBe(false);
    expect(ui.openChatOnLoad).toBe(false);
  });
});

describe('buildOnboardingMenuQuickLinksFromAllowedOrigins', () => {
  it('builds website and contact links from active allowed origin', () => {
    expect(
      buildOnboardingMenuQuickLinksFromAllowedOrigins([
        { origin: 'https://example.com', isActive: true },
      ]),
    ).toEqual([{ text: 'Visit website', route: 'https://example.com' }]);
  });

  it('returns empty when no active origin', () => {
    expect(buildOnboardingMenuQuickLinksFromAllowedOrigins([])).toEqual([]);
    expect(
      buildOnboardingMenuQuickLinksFromAllowedOrigins([{ origin: 'https://example.com', isActive: false }]),
    ).toEqual([]);
  });

  it('does not use Assistrio URLs', () => {
    const links = buildOnboardingMenuQuickLinksFromAllowedOrigins([
      { origin: 'https://shop.example.com', isActive: true },
    ]);
    for (const link of links) {
      expect(link.route).not.toContain('assistrio.com');
    }
  });
});
