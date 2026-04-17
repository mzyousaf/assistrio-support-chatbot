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
import { BotsModule } from '../bots/bots.module';
import { DocumentsModule } from '../documents/documents.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AnalyticsTrackController } from './analytics-track.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    AuthModule,
    BotsModule,
    DocumentsModule,
    WorkspacesModule,
    MongooseModule.forFeature([
      { name: VisitorEvent.name, schema: VisitorEventSchema },
      { name: Visitor.name, schema: VisitorSchema },
      { name: Bot.name, schema: BotSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    VisitorsModule,
  ],
  controllers: [AnalyticsTrackController, AdminAnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule { }
