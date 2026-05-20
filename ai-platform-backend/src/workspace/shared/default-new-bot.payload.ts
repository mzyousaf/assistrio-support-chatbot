/**
 * Default payload for a newly created bot (e.g. from POST /api/customer/bots/draft or /api/admin/bots/draft).
 * Maps to the nested API shape; getDefaultBotCreatePayload() converts to the flat Bot schema.
 */
import { generateBotAccessKey, generateBotSecretKey } from '../../bots/bot-keys.util';
import { DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE } from '../../models/bot.schema';
import { botKnowledgeBootstrapDefaults } from './default-bot-knowledge-bootstrap.util';

export const DEFAULT_NEW_BOT_PAYLOAD = {
  general: {
    name: 'AI Support Assistant',
    tagline: 'Instant answers to your questions',
    description:
      'An AI-powered support assistant designed to answer questions, provide guidance, and help users find information quickly.',
    avatarUrl:
      'https://assistrio-public-assets.s3.us-east-1.amazonaws.com/bots/avatars/2026/03/90584fd7-14bd-4b25-bbbd-4cad051d0825-180.png',
  },
  behavior: {
    categories: ['Documentation', 'Support', 'General'],
    customCategory: '',
    preset: 'support-agent',
    description:
      'You are an AI support assistant Assistrio. Help users find answers, guide them through documentation, and provide helpful explanations. If you do not know the answer, politely say so and suggest where they can find more information.',
    thingsToAvoid:
      'Do not invent information or make assumptions if the answer is unknown. Avoid giving legal, medical, or financial advice unless it is clearly present in the provided knowledge base. Always stay polite and professional.',
    welcomeMessage:
      "Hi! 👋 I'm {{Name}} — {{Tagline}}. How can I help you today?",
    suggestedQuestions: [
      'What services do you offer?',
      'How can I contact support?',
      'Do you offer refunds?',
    ],
    leadCapture: {
      enabled: true,
      fields: [
        { label: 'Name', key: 'name', type: 'text', required: true },
        { label: 'Email', key: 'email', type: 'email', required: true },
        { label: 'Company', key: 'company', type: 'text', required: false },
        { label: 'Phone', key: 'phone', type: 'phone', required: false },
      ],
      askStrategy: 'balanced' as const,
      captureMode: 'chat' as const,
    },
  },
  knowledge: {
    internalNotes: 'AI_GENERATED_ASSISTRIO_OVERVIEW',
    faqs: 'AI_GENERATED_FAQS',
    documents: [
      {
        title: 'Template Company Services Knowledge Base',
        fileName: 'Template-Company-Services-Knowledge-Base.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        url: 'https://assistrio-public-assets.s3.us-east-1.amazonaws.com/uploads/documents/69ab2ed9bd023d2a4076f3f8/2026/03/a671bae5-0700-497e-81a7-4c08d1f4d896-Template-Company-Services-Knowledge-Base.docx',
        status: 'pending',
        fileSize: 2.85 * 1024 * 1024,
      },
      {
        title: 'Template Company Refund Policy Knowledge Base',
        fileName: 'Template-Company-Refund-Policy-Knowledge-Base.txt',
        fileType: 'text/plain',
        url: 'https://assistrio-public-assets.s3.us-east-1.amazonaws.com/uploads/documents/69ab2ed9bd023d2a4076f3f8/2026/03/3197315d-5977-47f9-b7b3-f8d25dab1855-Template-Company-Refund-Policy-Knowledge-Base.txt',
        status: 'pending',
        fileSize: 6 * 1024,
      },
      {
        title: 'Template Company Profile Knowledge Base',
        fileName: 'Template-Company-Profile-Knowledge-Base.pdf',
        fileType: 'application/pdf',
        url: 'https://assistrio-public-assets.s3.us-east-1.amazonaws.com/uploads/documents/69ab2ed9bd023d2a4076f3f8/2026/03/96041882-4ba8-41d7-b68c-2d4a13b47775-Template-Company-Profile-Knowledge-Base.pdf',
        status: 'pending',
        fileSize: 113 * 1024,
      },
      {
        title: 'Template Company Product Knowledge Base',
        fileName: 'Template-Company-Product-Knowledge-Base.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        url: 'https://assistrio-public-assets.s3.us-east-1.amazonaws.com/uploads/documents/69ab2ed9bd023d2a4076f3f8/2026/03/664c4f62-abff-4edf-8e19-364e2c68529c-Template-Company-Product-Knowledge-Base.docx',
        status: 'pending',
        fileSize: 2.85 * 1024 * 1024,
      },
      {
        title: 'Template Company Information Knowledge Base',
        fileName: 'Template-Company-Information-Knowledge-Base.md',
        fileType: 'text/markdown',
        url: 'https://assistrio-public-assets.s3.us-east-1.amazonaws.com/uploads/documents/69ab2ed9bd023d2a4076f3f8/2026/03/8fb8ad69-6756-4587-8bb9-2206bfe3753e-Template-Company-Information-Knowledge-Base.md',
        status: 'pending',
        fileSize: 6 * 1024,
      },
    ],
  },
  ai: {
    openAiApiKeyOverride: null as string | null,
    language: 'auto',
    temperature: 0.3,
    maxTokens: 160,
    answerMode: 'knowledge_first' as const,
    whisperApiKey: null as string | null,
  },
  chatExperience: {
    allowFileUploads: false,
    showMicButton: false,
    showVoiceButton: false,
    showSuggestedQuestions: true,
    showCopyButton: true,
    showMessageFeedback: true,
    timePosition: 'bottom',
    showAvatarInHeader: true,
    statusIndicator: 'live',
    indicatorStyle: 'dot-only',
    dotStyle: 'blinking',
    scrollToBottomButton: true,
    messageListScrollbar: false,
    expandChat: true,
    openOnLoad: false,
    menuQuickLinks: [
      { text: 'About Assistrio', route: 'https://www.assistrio.com/about' },
      { text: 'Contact Support', route: 'https://www.assistrio.com/contact' },
    ],
    separateInputBox: true,
  },
  appearance: {
    primaryColor: '#14B8A6',
    backgroundStyle: 'light',
    shadowIntensity: 'medium',
    panelBorder: false,
    bubbleRadius: 20,
    launcherPosition: 'bottom-right',
    launcherIcon: 'default',
    launcherSize: 56,
    launcherRingWidth: 6,
    customLauncherAvatar: null as string | null,
    openAnimation: 'expand',
    composerBorderWidth: 1,
    composerBorderColor: 'default',
    showBranding: true,
    /** Empty = no default footer line; admins can add attribution later */
    brandingMessage: '',
  },
  publish: {
    public: false,
    status: 'draft',
  },
} as const;

export interface DefaultDocumentItem {
  title: string;
  url: string;
  status: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

const PRESET_MAP: Record<string, string> = {
  'support-agent': 'support',
  default: 'default',
  support: 'support',
  sales: 'sales',
  technical: 'technical',
  marketing: 'marketing',
  consultative: 'consultative',
  teacher: 'teacher',
  empathetic: 'empathetic',
  strict: 'strict',
};

export type DefaultBotCreatePayload = {
  name: string;
  slug: string;
  visibility: 'public' | 'private';
  accessKey: string;
  secretKey: string;
  status: 'draft';
  clientDraftId: string;
  isPublic: boolean;
  shortDescription: string;
  description: string;
  includeNameInKnowledge?: boolean;
  includeTaglineInKnowledge?: boolean;
  includeNotesInKnowledge?: boolean;
  category?: string;
  categories: string[];
  imageUrl: string;
  welcomeMessage: string;
  welcomeMessageEnabled: boolean;
  leadCapture: {
    enabled: boolean;
    fields: Array<{ key: string; label: string; type: string; required: boolean }>;
    askStrategy?: 'soft' | 'balanced' | 'direct';
    captureMode?: 'chat' | 'form' | 'hybrid';
  };
  chatUI: Record<string, unknown>;
  exampleQuestions: string[];
  personality: Record<string, unknown>;
  config: {
    temperature: number;
    maxTokens: number;
    responseLength?: string;
    answerMode?: 'knowledge_first' | 'knowledge_only';
  };
  openaiApiKeyOverride?: string | null;
  whisperApiKeyOverride?: string | null;
  /** Aligns with `Bot` schema default; set explicitly so new drafts always store 90 in Mongo. */
  widgetEmbedRateLimitPerMinute: number;
  createdAt: Date;
  knowledgeTraining: {
    autoTrainEnabled: boolean;
    trainingDelayMinutes: number;
    scheduleMode: 'smart';
  };
  knowledgeStats: import('../../models/bot-knowledge-stats.schema').BotKnowledgeStats;
};

export function getDefaultBotCreatePayload(
  slug: string,
  clientDraftId: string,
): DefaultBotCreatePayload {
  const g = DEFAULT_NEW_BOT_PAYLOAD.general;
  const b = DEFAULT_NEW_BOT_PAYLOAD.behavior;
  const ai = DEFAULT_NEW_BOT_PAYLOAD.ai;
  const ce = DEFAULT_NEW_BOT_PAYLOAD.chatExperience;
  const ap = DEFAULT_NEW_BOT_PAYLOAD.appearance;
  const pub = DEFAULT_NEW_BOT_PAYLOAD.publish;
  const behaviorPreset =
    PRESET_MAP[b.preset] ?? (b.preset === 'support-agent' ? 'support' : 'default');
  return {
    name: g.name,
    slug,
    visibility: 'public',
    accessKey: generateBotAccessKey(),
    secretKey: generateBotSecretKey(),
    status: pub.status as 'draft',
    clientDraftId,
    isPublic: pub.public,
    shortDescription: g.tagline,
    description: g.description,
    includeNameInKnowledge: true,
    includeTaglineInKnowledge: true,
    includeNotesInKnowledge: true,
    categories: b.categories.slice(),
    category: b.categories[0],
    imageUrl: g.avatarUrl,
    welcomeMessage: b.welcomeMessage,
    welcomeMessageEnabled: true,
    leadCapture: {
      enabled: b.leadCapture.enabled,
      fields: b.leadCapture.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required ?? false,
      })),
      askStrategy: b.leadCapture.askStrategy,
      captureMode: b.leadCapture.captureMode,
    },
    chatUI: {
      primaryColor: ap.primaryColor,
      backgroundStyle: ap.backgroundStyle,
      bubbleBorderRadius: ap.bubbleRadius,
      chatPanelBorderWidth: 1,
      launcherPosition: ap.launcherPosition,
      showBranding: ap.showBranding,
      brandingMessage: ap.brandingMessage,
      timePosition: ce.timePosition as 'top' | 'bottom',
      showScrollToBottom: ce.scrollToBottomButton,
      composerAsSeparateBox: ce.separateInputBox,
      menuQuickLinks: ce.menuQuickLinks.slice(),
      showAvatarInHeader: ce.showAvatarInHeader,
      statusIndicator: ce.statusIndicator,
      liveIndicatorStyle: (ce.indicatorStyle === 'dot-only' ? 'dot-only' : 'label') as 'label' | 'dot-only',
      statusDotStyle: (ce.dotStyle === 'blinking' ? 'blinking' : 'static') as 'blinking' | 'static',
      showComposerWithSuggestedQuestions: ce.showSuggestedQuestions,
      showCopyButton: ce.showCopyButton,
      showMessageFeedback: ce.showMessageFeedback,
      allowFileUpload: ce.allowFileUploads,
      showMic: ce.showMicButton,
      showVoice: ce.showVoiceButton,
      showMenuExpand: ce.expandChat,
    },
    exampleQuestions: b.suggestedQuestions.slice(),
    personality: {
      description: b.description,
      systemPrompt: b.description,
      behaviorPreset,
      thingsToAvoid: b.thingsToAvoid,
      language: ai.language === 'auto' ? 'en-US' : ai.language,
    },
    config: {
      temperature: ai.temperature,
      maxTokens: ai.maxTokens,
      responseLength: 'medium',
      answerMode: ai.answerMode,
    },
    widgetEmbedRateLimitPerMinute: DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE,
    openaiApiKeyOverride: ai.openAiApiKeyOverride ?? undefined,
    whisperApiKeyOverride: ai.whisperApiKey ?? undefined,
    createdAt: new Date(),
    ...botKnowledgeBootstrapDefaults(),
  };
}

/**
 * Unique template documents seeded on POST .../bots/draft (`onboardNewBot`).
 * Uses deduplicated URLs so this stays accurate if the static list ever repeats a file.
 */
export const DEFAULT_NEW_BOT_TEMPLATE_DOCUMENT_COUNT = (() => {
  const seen = new Set<string>();
  for (const d of DEFAULT_NEW_BOT_PAYLOAD.knowledge.documents) {
    const u = String((d as { url?: string }).url ?? '').trim();
    if (u) seen.add(u);
  }
  return seen.size;
})();

export function getDefaultNewBotDocuments(): DefaultDocumentItem[] {
  const seenUrls = new Set<string>();
  const out: DefaultDocumentItem[] = [];
  for (const d of DEFAULT_NEW_BOT_PAYLOAD.knowledge.documents) {
    const item = d as {
      title: string;
      url: string;
      status: string;
      fileName?: string;
      fileSize?: number;
      fileType?: string;
    };
    const url = String(item.url).trim();
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    out.push({
      title: item.title,
      url,
      status: item.status,
      fileName: item.fileName,
      fileSize: item.fileSize,
      fileType: item.fileType,
    });
  }
  return out;
}
