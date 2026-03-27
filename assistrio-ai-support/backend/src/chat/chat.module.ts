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
import { AuthModule } from '../auth/auth.module';
import { ChatController } from './chat.controller';
import { WidgetPreviewController } from './widget-preview.controller';
import { ChatEngineService } from './chat-engine.service';
import { ChatService } from './chat.service';
import { SummaryJobService } from './summary-job.service';

@Module({
  imports: [
    RagModule,
    BotsModule,
    AuthModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: SummaryJob.name, schema: SummaryJobSchema },
      { name: Bot.name, schema: BotSchema },
    ]),
  ],
  controllers: [ChatController, WidgetPreviewController],
  providers: [ChatService, ChatEngineService, SummaryJobService],
  exports: [ChatService, ChatEngineService, SummaryJobService],
})
export class ChatModule {}
