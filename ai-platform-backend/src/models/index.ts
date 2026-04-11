// Schemas and schema factories
export {
  Bot,
  BotSchema,
  BotLeadField,
  BotLeadCaptureV2,
  BotChatUI,
  BotPersonality,
  BotConfig,
} from './bot.schema';
export type {
  LeadFieldType,
  ChatBackgroundStyle,
  ChatLauncherPosition,
  ChatTimePosition,
  LiveIndicatorStyle,
  ChatStatusIndicator,
  BotVisibility,
  BotCreatorType,
  BotMessageLimitMode,
} from './bot.schema';

export { DocumentModel, DocumentSchema } from './document.schema';
export { Conversation, ConversationSchema } from './conversation.schema';
export type { CapturedLeadData, LeadCaptureMeta } from './conversation.schema';
export { Message, MessageSchema } from './message.schema';
export type { MessageSource } from './message.schema';
export { Visitor, VisitorSchema } from './visitor.schema';
export type { VisitorKind } from './visitor.schema';
export { TrialAccessToken, TrialAccessTokenSchema } from './trial-access-token.schema';
export {
  TrialDashboardSession,
  TrialDashboardSessionSchema,
} from './trial-dashboard-session.schema';
export {
  TrialEmailWorkspace,
  TrialEmailWorkspaceSchema,
} from './trial-email-workspace.schema';
export type { TrialEmailWorkspaceDocument } from './trial-email-workspace.schema';
export {
  TrialOnboardingDraft,
  TrialOnboardingDraftSchema,
  TrialOnboardingQuickLink,
  TrialOnboardingQuickLinkSchema,
  TrialOnboardingAssetMeta,
  TrialOnboardingAssetMetaSchema,
} from './trial-onboarding-draft.schema';
export { VisitorEvent, VisitorEventSchema } from './visitor-event.schema';
export type { VisitorEventType } from './visitor-event.schema';
export { RateLimit, RateLimitSchema } from './rate-limit.schema';
export { Config, ConfigSchema } from './config.schema';
export { User, UserSchema, USER_ROLES } from './user.schema';
export type { UserRole } from './user.schema';
export { Workspace, WorkspaceSchema } from './workspace.schema';
export {
  WorkspaceMembership,
  WorkspaceMembershipSchema,
  WORKSPACE_MEMBER_ROLES,
} from './workspace-membership.schema';
export type { WorkspaceMemberRole } from './workspace-membership.schema';
export { IngestJob, IngestJobSchema } from './ingest-job.schema';
export type { IngestJobStatus } from './ingest-job.schema';
export { SummaryJob, SummaryJobSchema } from './summary-job.schema';
export type { SummaryJobStatus } from './summary-job.schema';
export {
  KnowledgeBaseItem,
  KnowledgeBaseItemSchema,
  KNOWLEDGE_BASE_ITEM_SOURCE_TYPES,
} from './knowledge-base-item.schema';
export type {
  KnowledgeBaseItemSourceType,
  KnowledgeBaseItemStatus,
  KnowledgeBaseItemSourceMeta,
  KnowledgeBaseItemFaqMeta,
  KnowledgeBaseItemNoteMeta,
} from './knowledge-base-item.schema';
export { KnowledgeBaseChunk, KnowledgeBaseChunkSchema } from './knowledge-base-chunk.schema';
