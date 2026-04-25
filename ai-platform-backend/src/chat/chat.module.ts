import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Bot,
  BotSchema,
  Conversation,
  ConversationSchema,
  Message,
  MessageSchema,
  SummaryJob,
  SummaryJobSchema,
} from '../models';
import { RagModule } from '../rag/rag.module';
import { BotsModule } from '../bots/bots.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ChatController } from './chat.controller';
import { WidgetPreviewController } from './widget-preview.controller';
import { ChatEngineService } from './chat-engine.service';
import { ChatService } from './chat.service';
import { SummaryJobService } from './summary-job.service';
import { WhisperTranscriptionService } from './whisper-transcription.service';
import { WidgetSpeechService } from './widget-speech.service';

@Module({
  imports: [
    RagModule,
    BotsModule,
    VisitorsModule,
    AuthModule,
    WorkspacesModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: SummaryJob.name, schema: SummaryJobSchema },
      { name: Bot.name, schema: BotSchema },
    ]),
  ],
  controllers: [ChatController, WidgetPreviewController],
  providers: [ChatService, ChatEngineService, SummaryJobService, WhisperTranscriptionService, WidgetSpeechService],
  exports: [ChatService, ChatEngineService, SummaryJobService, WidgetSpeechService],
})
export class ChatModule { }
