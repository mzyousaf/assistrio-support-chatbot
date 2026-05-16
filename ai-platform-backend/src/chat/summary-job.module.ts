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
import { SummaryJobService } from './summary-job.service';

/**
 * Extracted so `WorkerAppModule` can run conversation summary jobs without importing the full `ChatModule`.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SummaryJob.name, schema: SummaryJobSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Bot.name, schema: BotSchema },
    ]),
  ],
  providers: [SummaryJobService],
  exports: [SummaryJobService],
})
export class SummaryJobModule {}
