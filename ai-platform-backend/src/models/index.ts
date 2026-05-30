// Schemas and schema factories
export {
  Bot,
  BotSchema,
  BotLeadField,
  BotLeadCaptureV2,
  BotAllowedOrigin,
  BotShareChat,
  BotChatUI,
  BotPersonality,
  BotConfig,
  BotKnowledgeSizeConfig,
  BotKnowledgeSizeConfigSchema,
  BotPlanConfig,
  BotPlanConfigSchema,
} from './bot.schema';
export {
  BotKnowledgeStats,
  BotKnowledgeStatsByType,
  BotKnowledgeTypeStats,
  BotKnowledgeTrainingSettings,
} from './bot-knowledge-stats.schema';
export type {
  LeadFieldType,
  ChatBackgroundStyle,
  ChatLauncherPosition,
  ChatTimePosition,
  LiveIndicatorStyle,
  ChatStatusIndicator,
  BotVisibility,
} from './bot.schema';

export {
  Conversation,
  ConversationSchema,
  ConversationOrigin,
  ConversationLocation,
  ConversationDeviceInfo,
  ConversationTopicsSummary,
  ConversationSentimentSummary,
} from './conversation.schema';
export type {
  CapturedLeadData,
  LeadCaptureMeta,
  ConversationOriginSource,
  ConversationStartedFrom,
  ConversationAnalyticsStatus,
} from './conversation.schema';
export {
  Message,
  MessageAttachment,
  MessageSchema,
  MessageSpeechInput,
  MessageSource,
  MessageSourceSchema,
  MessageVoiceMeta,
  MessageAiMeta,
  MessageTopics,
  MessageSentiment,
  MessageFeedback,
  MessageFeedbackSchema,
} from './message.schema';
export type { MessageInputType, MessageInputMethod } from './message.schema';
export {
  UsageLedger,
  UsageLedgerSchema,
  USAGE_LEDGER_MONGO_COLLECTION,
} from './usage-ledger.schema';
export type { UsageLedgerUsageType } from './usage-ledger.schema';
export { Visitor, VisitorSchema } from './visitor.schema';
export type { VisitorKind } from './visitor.schema';
export { VisitorEvent, VisitorEventSchema } from './visitor-event.schema';
export type { VisitorEventType } from './visitor-event.schema';
export { RateLimit, RateLimitSchema } from './rate-limit.schema';
export { Config, ConfigSchema } from './config.schema';
export {
  User,
  UserSchema,
  USER_ROLES,
  AUTH_ACCOUNT_PROVIDERS,
} from './user.schema';
export type { UserRole, AccountAuthProvider } from './user.schema';
export { Workspace, WorkspaceSchema } from './workspace.schema';
export {
  WORKSPACE_ONBOARDING_STATUSES,
  WORKSPACE_ONBOARDING_STEPS,
  DEFAULT_WORKSPACE_ONBOARDING_STATUS,
  DEFAULT_WORKSPACE_ONBOARDING_STEP,
  isWorkspaceOnboardingStatus,
  isWorkspaceOnboardingStep,
} from './workspace-onboarding.constants';
export type {
  WorkspaceOnboardingStatus,
  WorkspaceOnboardingStep,
} from './workspace-onboarding.constants';
export {
  WorkspaceOnboardingDraft,
  WorkspaceOnboardingDraftSchema,
  WorkspaceOnboardingDraftProfile,
  WorkspaceOnboardingDraftInstructions,
  WorkspaceOnboardingDraftKnowledge,
  WorkspaceOnboardingDraftGoLive,
  WorkspaceOnboardingDraftAllowedOrigin,
} from './workspace-onboarding-draft.schema';
export {
  WorkspaceOnboardingDraftFaq,
  WorkspaceOnboardingDraftSnippet,
  WorkspaceOnboardingDraftQa,
} from './workspace-onboarding-knowledge.schema';
export {
  WorkspaceOnboardingKnowledgeStaging,
  WorkspaceOnboardingKnowledgeStagingSchema,
} from './workspace-onboarding-knowledge-staging.schema';
export type {
  OnboardingKnowledgeStagingSourceType,
  OnboardingKnowledgeStagingStatus,
} from './workspace-onboarding-knowledge-staging.schema';
export {
  WorkspaceMembership,
  WorkspaceMembershipSchema,
  WORKSPACE_MEMBER_ROLES,
  WORKSPACE_MANAGER_ROLES,
  WORKSPACE_OWNER_ROLE,
  WORKSPACE_ADMIN_ROLE,
  WORKSPACE_MEMBER_ROLE,
} from './workspace-membership.schema';
export type { WorkspaceMemberRole, WorkspaceManagerRole } from './workspace-membership.schema';
export {
  isWorkspaceOwnerRole,
  isWorkspaceAdminRole,
  isWorkspaceManagerRole,
  isWorkspaceMemberOnlyRole,
  workspaceManagerRoleRank,
} from './workspace-membership-role.util';
export {
  WORKSPACE_INVITE_STATUSES,
  WORKSPACE_INVITE_DEFAULT_TTL_MS,
  WORKSPACE_INVITE_ALREADY_PENDING_CODE,
  WORKSPACE_INVITE_ALREADY_PENDING_MESSAGE,
  isWorkspaceInviteStatus,
  workspaceInviteExpiresAtFromNow,
  WORKSPACE_INVITE_NOT_FOUND_CODE,
  WORKSPACE_INVITE_EXPIRED_CODE,
  WORKSPACE_INVITE_CANCELLED_CODE,
  WORKSPACE_INVITE_ALREADY_ACCEPTED_CODE,
  WORKSPACE_INVITE_EMAIL_MISMATCH_CODE,
  WORKSPACE_INVITE_MEMBER_EXISTS_CODE,
  WORKSPACE_ACCESS_DENIED_CODE,
  WORKSPACE_LAST_ADMIN_REQUIRED_CODE,
  WORKSPACE_LAST_MANAGER_REQUIRED_CODE,
  WORKSPACE_OWNER_PROTECTED_CODE,
  WORKSPACE_INVITE_ROLES,
} from './workspace-invite.constants';
export type { WorkspaceInviteStatus, WorkspaceInviteRole } from './workspace-invite.constants';
export { WorkspaceInvite, WorkspaceInviteSchema } from './workspace-invite.schema';
export {
  WorkspaceBotAccessGrant,
  WorkspaceBotAccessGrantSchema,
  WORKSPACE_BOT_ACCESS_GRANT_SUBJECT_TYPES,
} from './workspace-bot-access-grant.schema';
export type { WorkspaceBotAccessGrantSubjectType } from './workspace-bot-access-grant.schema';
export {
  WorkspaceSubscription,
  WorkspaceSubscriptionSchema,
  WORKSPACE_SUBSCRIPTION_STATUSES,
} from './workspace-subscription.schema';
export type { WorkspaceSubscriptionStatus } from './workspace-subscription.schema';
export {
  BillingWebhookEventRecord,
  BillingWebhookEventSchema,
  BILLING_WEBHOOK_EVENT_STATUSES,
} from './billing-webhook-event.schema';
export type { BillingWebhookEventStatus } from './billing-webhook-event.schema';
export {
  WorkspaceAddon,
  WorkspaceAddonSchema,
  WORKSPACE_ADDON_STATUSES,
} from './workspace-addon.schema';
export type { WorkspaceAddonStatus } from './workspace-addon.schema';
export { WorkspaceCreditTopUp, WorkspaceCreditTopUpSchema } from './workspace-credit-top-up.schema';
export {
  WorkspaceBillingOrder,
  WorkspaceBillingOrderSchema,
  WORKSPACE_BILLING_CHECKOUT_TYPES,
} from './workspace-billing-order.schema';
export type { WorkspaceBillingCheckoutType } from './workspace-billing-order.schema';
export {
  WorkspaceBillingProfile,
  WorkspaceBillingProfileSchema,
} from './workspace-billing-profile.schema';
export {
  ExtractJob,
  ExtractJobSchema,
  EXTRACT_JOB_MONGO_COLLECTION,
} from './extract-job.schema';
export type { ExtractJobStatus } from './extract-job.schema';
/** @deprecated Use `ExtractJobStatus`; kept for call-site clarity (same union). */
export type { ExtractJobStatus as IngestJobStatus } from './extract-job.schema';
export {
  TrainJob,
  TrainJobSchema,
  TRAIN_JOB_MONGO_COLLECTION,
  KNOWLEDGE_TRAINING_SCOPES,
} from './train-job.schema';
export type {
  TrainJobStatus,
  TrainJobKind,
  KnowledgeTrainingScope,
} from './train-job.schema';
/** @deprecated Use `TrainJobStatus`. */
export type { TrainJobStatus as KnowledgeTrainingJobStatus } from './train-job.schema';
export { SummaryJob, SummaryJobSchema } from './summary-job.schema';
export type { SummaryJobStatus } from './summary-job.schema';
export {
  TableImportSession,
  TableImportSessionSchema,
  TABLE_IMPORT_SESSION_MONGO_COLLECTION,
} from './table-import-session.schema';
export {
  TableImportJob,
  TableImportJobSchema,
  TABLE_IMPORT_JOB_MONGO_COLLECTION,
} from './table-import-job.schema';
export type { TableImportJobStatus } from './table-import-job.schema';
export {
  OnboardingKbTransferJob,
  OnboardingKbTransferJobSchema,
  ONBOARDING_KB_TRANSFER_JOB_MONGO_COLLECTION,
  ONBOARDING_KB_TRANSFER_JOB_TYPE,
} from './onboarding-kb-transfer-job.schema';
export type { OnboardingKbTransferJobStatus } from './onboarding-kb-transfer-job.schema';
export {
  KnowledgeBaseItem,
  KnowledgeBaseItemSchema,
  KNOWLEDGE_BASE_ITEM_SOURCE_TYPES,
  KNOWLEDGE_BASE_ITEM_TRAINING_STATUSES,
  KNOWLEDGE_BASE_ITEM_EXTRACTION_STATUSES,
} from './knowledge-base-item.schema';
export type {
  KnowledgeBaseItemSourceType,
  KnowledgeBaseItemStatus,
  KnowledgeBaseItemTrainingStatus,
  KnowledgeBaseItemExtractionStatus,
  KnowledgeBaseItemFaqMeta,
  KnowledgeBaseItemNoteMeta,
  KnowledgeBaseItemTableMeta,
} from './knowledge-base-item.schema';
export { KnowledgeBaseChunk, KnowledgeBaseChunkSchema } from './knowledge-base-chunk.schema';
