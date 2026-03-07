import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema, DocumentModel, DocumentSchema, Message, MessageSchema } from '../models';
import { RagModule } from '../rag/rag.module';
import { ChatController } from './chat.controller';
import { ChatEngineService } from './chat-engine.service';
import { ChatService } from './chat.service';

@Module({
  imports: [
    RagModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: DocumentModel.name, schema: DocumentSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatEngineService],
  exports: [ChatService, ChatEngineService],
})
export class ChatModule {}
