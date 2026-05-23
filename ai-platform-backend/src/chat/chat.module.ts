import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Bot,
  BotSchema,
  Conversation,
  ConversationSchema,
  Message,
  MessageSchema,
  UsageLedger,
  UsageLedgerSchema,
} from '../models';
import { RagModule } from '../rag/rag.module';
import { BotsModule } from '../bots/bots.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ChatController } from './chat.controller';
import { WidgetPreviewController } from './widget-preview.controller';
import { ChatEngineService } from './chat-engine.service';
import { ChatService } from './chat.service';
import { ResponseStyleRefineService } from './response-style-refine.service';
import { SummaryJobModule } from './summary-job.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { WidgetSpeechService } from './widget-speech.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SharedChatController } from '../bots/shared-chat.controller';
import { TopicSentimentClassificationModule } from '../analytics/topic-sentiment-classification.module';

@Module({
  imports: [
    RagModule,
    KnowledgeModule,
    BotsModule,
    VisitorsModule,
    AuthModule,
    WorkspacesModule,
    EntitlementsModule,
    SummaryJobModule,
    TranscriptionModule,
    TopicSentimentClassificationModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Bot.name, schema: BotSchema },
      { name: UsageLedger.name, schema: UsageLedgerSchema },
    ]),
  ],
  controllers: [ChatController, WidgetPreviewController, SharedChatController],
  providers: [
    ChatService,
    ChatEngineService,
    WidgetSpeechService,
    ResponseStyleRefineService,
  ],
  exports: [ChatService, ChatEngineService, SummaryJobModule, WidgetSpeechService, ResponseStyleRefineService],
})
export class ChatModule { }
