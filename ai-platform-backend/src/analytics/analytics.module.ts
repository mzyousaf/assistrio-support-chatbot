import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Bot,
  BotSchema,
  Conversation,
  ConversationSchema,
  Message,
  MessageSchema,
  Visitor,
  VisitorSchema,
  VisitorEvent,
  VisitorEventSchema,
} from '../models';
import { AuthModule } from '../auth/auth.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsTrackController } from './analytics-track.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: VisitorEvent.name, schema: VisitorEventSchema },
      { name: Visitor.name, schema: VisitorSchema },
      { name: Bot.name, schema: BotSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    VisitorsModule,
  ],
  controllers: [AnalyticsController, AnalyticsTrackController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule { }
