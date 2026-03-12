import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Bot,
  BotSchema,
  Conversation,
  ConversationSchema,
  DocumentModel,
  DocumentSchema,
  Message,
  MessageSchema,
  SummaryJob,
  SummaryJobSchema,
} from '../models';
import { RagModule } from '../rag/rag.module';
import { ChatController } from './chat.controller';
import { ChatEngineService } from './chat-engine.service';
import { ChatService } from './chat.service';
import { SummaryJobService } from './summary-job.service';

@Module({
  imports: [
    RagModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: DocumentModel.name, schema: DocumentSchema },
      { name: SummaryJob.name, schema: SummaryJobSchema },
      { name: Bot.name, schema: BotSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatEngineService, SummaryJobService],
  exports: [ChatService, ChatEngineService, SummaryJobService],
})
export class ChatModule {}
