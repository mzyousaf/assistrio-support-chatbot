import type {
  WorkspaceOnboardingStatus,
  WorkspaceOnboardingStep,
} from '../models/workspace-onboarding.constants';

export type WorkspaceOnboardingDraftProfileDto = {
  name?: string;
  shortDescription?: string;
  description?: string;
  brandColor?: string;
  categories?: string[];
  avatarSource?: string;
  imageUrl?: string;
  avatarEmoji?: string;
  avatarStorageKey?: string;
};

export type WorkspaceOnboardingDraftInstructionsDto = {
  description: string;
  systemPrompt?: string;
  tone?: string;
  behaviorPreset?: string;
  responseLength?: string;
  maxTokens?: number;
};

export type WorkspaceOnboardingDraftFaqDto = {
  question: string;
  answer: string;
};

export type WorkspaceOnboardingDraftSnippetDto = {
  id: string;
  title: string;
  description: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  sequence?: number;
  updateSequence?: number;
};

export type WorkspaceOnboardingDraftQaDto = {
  id: string;
  title: string;
  questions: string[];
  answer: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  sequence?: number;
  updateSequence?: number;
};

export type WorkspaceOnboardingDraftKnowledgeDto = {
  knowledgeDescription?: string;
  faqs?: WorkspaceOnboardingDraftFaqDto[];
  snippets?: WorkspaceOnboardingDraftSnippetDto[];
  qas?: WorkspaceOnboardingDraftQaDto[];
};

export type WorkspaceOnboardingDraftAllowedOriginDto = {
  origin: string;
  label?: string;
  isActive?: boolean;
};

export type WorkspaceOnboardingDraftGoLiveDto = {
  allowedOrigins?: WorkspaceOnboardingDraftAllowedOriginDto[];
};

export type WorkspaceOnboardingDraftSnapshot = {
  profile: {
    name: string;
    shortDescription: string;
    description: string;
    brandColor: string;
    categories: string[];
    avatarSource: string;
    imageUrl: string;
    avatarEmoji: string;
    avatarStorageKey: string;
  };
  instructions: {
    description: string;
    systemPrompt: string;
    tone: string;
    behaviorPreset: string;
    responseLength: string;
    maxTokens: number;
  };
  knowledge: {
    snippets: WorkspaceOnboardingDraftSnippetDto[];
    qas: WorkspaceOnboardingDraftQaDto[];
    /** Legacy single snippet body — derived from snippets[0] when present. */
    knowledgeDescription: string;
    /** Legacy FAQ rows — derived from qas. */
    faqs: WorkspaceOnboardingDraftFaqDto[];
  };
  goLive: {
    allowedOrigins: WorkspaceOnboardingDraftAllowedOriginDto[];
  };
  stepsCompleted: WorkspaceOnboardingStep[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type WorkspaceOnboardingStagedKnowledgeItemDto = {
  id: string;
  sourceType: 'document' | 'datasheet';
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  errorMessage?: string;
  createdAt: string | null;
  metadata?: Record<string, unknown>;
};

export type WorkspaceOnboardingStagedKnowledgeDto = {
  documents: WorkspaceOnboardingStagedKnowledgeItemDto[];
  datasheets: WorkspaceOnboardingStagedKnowledgeItemDto[];
};

export type WorkspaceOnboardingResponse = {
  workspaceId: string;
  onboardingStatus: WorkspaceOnboardingStatus;
  onboardingCurrentStep: WorkspaceOnboardingStep;
  onboardingDraftId: string | null;
  onboardingCreatedBotId: string | null;
  onboardingCompletedAt: string | null;
  draft: WorkspaceOnboardingDraftSnapshot;
  stagedKnowledge?: WorkspaceOnboardingStagedKnowledgeDto;
};

export type WorkspaceOnboardingProgressPatch = {
  currentStep?: WorkspaceOnboardingStep;
  completedStep?: WorkspaceOnboardingStep;
};

export type WorkspaceOnboardingSummary = {
  onboardingStatus: WorkspaceOnboardingStatus;
  onboardingCurrentStep: WorkspaceOnboardingStep;
  onboardingCreatedBotId: string | null;
};

export type WorkspaceOnboardingGoLiveRequest = {
  origin?: string;
  label?: string;
  idempotencyKey?: string;
};

export type WorkspaceOnboardingGoLiveBotPayload = {
  id: string;
  name: string;
  slug: string;
  status: 'published';
  accessKey: string;
  secretKey?: string;
  visibility: 'public' | 'private';
  allowedOrigins: WorkspaceOnboardingDraftAllowedOriginDto[];
};

export type WorkspaceOnboardingGoLiveResponse = {
  workspaceId: string;
  onboardingStatus: WorkspaceOnboardingStatus;
  onboardingCurrentStep: WorkspaceOnboardingStep;
  bot: WorkspaceOnboardingGoLiveBotPayload;
  /** True when inline or staged knowledge transfer was enqueued and may still be processing. */
  knowledgeProcessingPending?: boolean;
  knowledgeProcessingMessage?: string;
};

export const WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES = {
  profileIncomplete: 'onboarding_profile_incomplete',
  instructionsIncomplete: 'onboarding_instructions_incomplete',
  knowledgeIncomplete: 'onboarding_knowledge_incomplete',
  originRequired: 'onboarding_origin_required',
  originInvalid: 'onboarding_origin_invalid',
  allowedOriginsLimitReached: 'onboarding_allowed_origins_limit_reached',
  transferFailed: 'onboarding_transfer_failed',
} as const;

export type WorkspaceOnboardingGoLiveErrorCode =
  (typeof WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES)[keyof typeof WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES];

export const WORKSPACE_ONBOARDING_COMPLETE_ERROR_CODES = {
  notLive: 'onboarding_not_live',
} as const;

export type WorkspaceOnboardingCompleteErrorCode =
  (typeof WORKSPACE_ONBOARDING_COMPLETE_ERROR_CODES)[keyof typeof WORKSPACE_ONBOARDING_COMPLETE_ERROR_CODES];

