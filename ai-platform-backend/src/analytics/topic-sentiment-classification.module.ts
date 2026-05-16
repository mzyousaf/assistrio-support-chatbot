import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema, Message, MessageSchema } from '../models';
import { TopicSentimentClassificationService } from './topic-sentiment-classification.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
  ],
  providers: [TopicSentimentClassificationService],
  exports: [TopicSentimentClassificationService],
})
export class TopicSentimentClassificationModule {}
