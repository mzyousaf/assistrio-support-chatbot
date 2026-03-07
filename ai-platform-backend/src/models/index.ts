// Schemas and schema factories
export {
  Bot,
  BotSchema,
  BotLeadField,
  BotLeadCaptureV2,
  BotChatUI,
  BotFaq,
  BotPersonality,
  BotConfig,
} from './bot.schema';
export type { LeadFieldType, ChatBackgroundStyle, ChatLauncherPosition, ChatTimePosition, LiveIndicatorStyle, ChatStatusIndicator } from './bot.schema';

export { DocumentModel, DocumentSchema } from './document.schema';
export { Chunk, ChunkSchema } from './chunk.schema';
export { Conversation, ConversationSchema } from './conversation.schema';
export { Message, MessageSchema } from './message.schema';
export { Visitor, VisitorSchema } from './visitor.schema';
export { VisitorEvent, VisitorEventSchema } from './visitor-event.schema';
export type { VisitorEventType } from './visitor-event.schema';
export { RateLimit, RateLimitSchema } from './rate-limit.schema';
export { Config, ConfigSchema } from './config.schema';
export { SuperAdminUser, SuperAdminUserSchema } from './super-admin-user.schema';
export { IngestJob, IngestJobSchema } from './ingest-job.schema';
export type { IngestJobStatus } from './ingest-job.schema';
