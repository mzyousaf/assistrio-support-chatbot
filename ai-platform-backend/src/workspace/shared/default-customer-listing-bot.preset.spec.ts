import {
  buildCustomerListingDraftBotPreset,
  CUSTOMER_LISTING_DRAFT_DEFAULTS,
} from './default-customer-listing-bot.preset';
import { ONBOARDING_DEFAULT_PRIMARY_COLOR } from './default-onboarding-bot.preset';

describe('buildCustomerListingDraftBotPreset', () => {
  it('uses clean listing defaults without template avatar or suggested questions', () => {
    const preset = buildCustomerListingDraftBotPreset('ai-agent', 'draft-1');

    expect(preset.name).toBe(CUSTOMER_LISTING_DRAFT_DEFAULTS.name);
    expect(preset.status).toBe('draft');
    expect(preset.shortDescription).toBe(CUSTOMER_LISTING_DRAFT_DEFAULTS.shortDescription);
    expect(preset.description).toBe(CUSTOMER_LISTING_DRAFT_DEFAULTS.description);
    expect(preset.categories).toEqual(['Support', 'General Support']);
    expect(preset.category).toBe('Support');
    expect(preset.imageUrl).toBe('');
    expect(preset.exampleQuestions).toEqual([]);
    expect(preset.personality).toMatchObject({
      behaviorPreset: 'support',
      tone: 'friendly',
      thingsToAvoid: CUSTOMER_LISTING_DRAFT_DEFAULTS.thingsToAvoid,
    });
    expect(preset.config).toMatchObject({
      answerMode: 'knowledge_first',
      responseLength: 'medium',
    });
    expect(preset.chatUI).toMatchObject({
      primaryColor: ONBOARDING_DEFAULT_PRIMARY_COLOR,
      headerStyle: 'brand',
      showBranding: false,
      brandingMessage: '',
      showPrivacyText: true,
      privacyText: '',
      menuQuickLinks: [],
    });
  });

  it('applies optional overrides from the listing create payload', () => {
    const preset = buildCustomerListingDraftBotPreset('custom-agent', 'draft-2', {
      name: 'Custom Agent',
      description: 'Custom description.',
      category: 'Sales',
      brandColor: '#112233',
    });

    expect(preset.name).toBe('Custom Agent');
    expect(preset.description).toBe('Custom description.');
    expect(preset.personality).toMatchObject({
      description: 'Custom description.',
      systemPrompt: 'Custom description.',
    });
    expect(preset.categories).toEqual(['Sales']);
    expect(preset.category).toBe('Sales');
    expect(preset.chatUI.primaryColor).toBe('#112233');
  });
});
