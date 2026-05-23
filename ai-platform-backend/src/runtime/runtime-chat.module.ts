import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bot, BotSchema, Conversation, ConversationSchema, Message, MessageSchema } from '../models';
import { RagModule } from '../rag/rag.module';
import { SummaryJobModule } from '../chat/summary-job.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ChatController } from '../chat/chat.controller';
import { WidgetPreviewController } from '../chat/widget-preview.controller';
import { TranscriptionModule } from '../transcription/transcription.module';
import { ChatService } from '../chat/chat.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import { WidgetSpeechService } from '../chat/widget-speech.service';
import { RuntimeAuthCoreModule } from './runtime-auth-core.module';
import { RuntimeBotsReadModule } from './runtime-bots-read.module';
import { VisitorsRuntimeModule } from './visitors-runtime.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SharedChatController } from '../bots/shared-chat.controller';
import { WidgetIframeController } from '../bots/widget-iframe.controller';

/**
 * Public widget + preview chat HTTP surface (`/api/chat/*`, `/api/widget/preview/*`).
 * Does not register `APP_MODE=api` workspace customer playground (`/api/customer/bots/:id/chat`).
 */
@Module({
  imports: [
    RagModule,
    SummaryJobModule,
    RuntimeBotsReadModule,
    RuntimeAuthCoreModule,
    WorkspacesModule,
    TranscriptionModule,
    VisitorsRuntimeModule,
    KnowledgeModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Bot.name, schema: BotSchema },
    ]),
  ],
  controllers: [ChatController, WidgetPreviewController, SharedChatController, WidgetIframeController],
  providers: [ChatService, ChatEngineService, WidgetSpeechService],
  exports: [ChatEngineService, WidgetSpeechService],
})
export class RuntimeChatModule {}
