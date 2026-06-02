import { DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE } from '../../models/bot.schema';
import { botKnowledgeBootstrapDefaults } from './default-bot-knowledge-bootstrap.util';
import {
  buildOnboardingChatUI,
  normalizeOnboardingBrandColor,
  ONBOARDING_BOT_CONFIG_DEFAULTS,
  ONBOARDING_DEFAULT_PRIMARY_COLOR,
} from './default-onboarding-bot.preset';
import { generateBotAccessKey, generateBotSecretKey } from '../../bots/bot-keys.util';
import type { DefaultBotCreatePayload } from './default-new-bot.payload';
import { DEFAULT_NEW_BOT_PAYLOAD } from './default-new-bot.payload';

export const CUSTOMER_LISTING_DRAFT_DEFAULTS = {
  name: 'AI Agent',
  shortDescription: 'Helpful AI support agent',
  description:
    'A helpful AI support agent that answers customer questions clearly and professionally.',
  categories: ['Support', 'General Support'] as const,
  category: 'Support',
  behaviorPreset: 'support' as const,
  tone: 'friendly',
  thingsToAvoid: [
    'Do not use negative, rude, blaming, or aggressive language.',
    'Do not make unsupported claims.',
    'Do not promise refunds, discounts, or outcomes unless present in knowledge base.',
    'Do not ask for sensitive information unnecessarily.',
  ].join(' '),
  welcomeMessage: "Hi! 👋 I'm {{Name}} — {{Tagline}}. How can I help you today?",
} as const;

export type CustomerListingDraftOverrides = {
  name?: string;
  description?: string;
  shortDescription?: string;
  /** Primary category label or value (e.g. Support). */
  category?: string;
  brandColor?: string;
};

function resolveListingCategories(category?: string): { categories: string[]; category?: string } {
  const trimmed = String(category ?? '').trim();
  if (!trimmed) {
    return {
      categories: [...CUSTOMER_LISTING_DRAFT_DEFAULTS.categories],
      category: CUSTOMER_LISTING_DRAFT_DEFAULTS.category,
    };
  }
  const categories =
    trimmed === CUSTOMER_LISTING_DRAFT_DEFAULTS.category
      ? [...CUSTOMER_LISTING_DRAFT_DEFAULTS.categories]
      : [trimmed];
  return { categories, category: categories[0] };
}

/**
 * Clean draft defaults for POST /api/customer/bots/draft from the agents listing.
 * No template KB, documents, FAQs, or AI-generated content.
 */
export function buildCustomerListingDraftBotPreset(
  slug: string,
  clientDraftId: string,
  overrides?: CustomerListingDraftOverrides,
): DefaultBotCreatePayload {
  const name = String(overrides?.name ?? CUSTOMER_LISTING_DRAFT_DEFAULTS.name).trim() || CUSTOMER_LISTING_DRAFT_DEFAULTS.name;
  const description =
    String(overrides?.description ?? CUSTOMER_LISTING_DRAFT_DEFAULTS.description).trim() ||
    CUSTOMER_LISTING_DRAFT_DEFAULTS.description;
  const shortDescription =
    String(overrides?.shortDescription ?? CUSTOMER_LISTING_DRAFT_DEFAULTS.shortDescription).trim() ||
    CUSTOMER_LISTING_DRAFT_DEFAULTS.shortDescription;
  const { categories, category } = resolveListingCategories(overrides?.category);
  const primaryColor = normalizeOnboardingBrandColor(overrides?.brandColor ?? ONBOARDING_DEFAULT_PRIMARY_COLOR);
  const leadCapture = DEFAULT_NEW_BOT_PAYLOAD.behavior.leadCapture;

  return {
    name,
    slug,
    visibility: 'public',
    accessKey: generateBotAccessKey(),
    secretKey: generateBotSecretKey(),
    status: 'draft',
    clientDraftId,
    isPublic: false,
    shortDescription,
    description,
    includeNameInKnowledge: true,
    includeTaglineInKnowledge: true,
    includeNotesInKnowledge: true,
    categories: categories.slice(),
    category,
    imageUrl: '',
    welcomeMessage: CUSTOMER_LISTING_DRAFT_DEFAULTS.welcomeMessage,
    welcomeMessageEnabled: true,
    leadCapture: {
      enabled: leadCapture.enabled,
      fields: leadCapture.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required ?? false,
      })),
      askStrategy: leadCapture.askStrategy,
      captureMode: leadCapture.captureMode,
    },
    chatUI: {
      ...buildOnboardingChatUI(primaryColor, []),
      brandingMessage: '',
    },
    exampleQuestions: [],
    personality: {
      description,
      systemPrompt: description,
      behaviorPreset: CUSTOMER_LISTING_DRAFT_DEFAULTS.behaviorPreset,
      tone: CUSTOMER_LISTING_DRAFT_DEFAULTS.tone,
      thingsToAvoid: CUSTOMER_LISTING_DRAFT_DEFAULTS.thingsToAvoid,
      language: 'en-US',
    },
    config: {
      temperature: ONBOARDING_BOT_CONFIG_DEFAULTS.temperature,
      maxTokens: 160,
      responseLength: 'medium',
      answerMode: ONBOARDING_BOT_CONFIG_DEFAULTS.answerMode,
    },
    widgetEmbedRateLimitPerMinute: DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE,
    createdAt: new Date(),
    ...botKnowledgeBootstrapDefaults(),
  };
}
