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
import { CustomerChatsAnalyticsService } from './customer-chats-analytics.service';
import { CustomerLeadsAnalyticsService } from './customer-leads-analytics.service';
import { CustomerTopicsAnalyticsService } from './customer-topics-analytics.service';
import { CustomerSentimentAnalyticsService } from './customer-sentiment-analytics.service';
import { CustomerAgentResourcesAnalyticsService } from './customer-agent-resources-analytics.service';
import { CustomerUsageAnalyticsService } from './customer-usage-analytics.service';

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
      { name: UsageLedger.name, schema: UsageLedgerSchema },
    ]),
    VisitorsModule,
  ],
  controllers: [AnalyticsTrackController, AdminAnalyticsController],
  providers: [
    AnalyticsService,
    CustomerChatsAnalyticsService,
    CustomerLeadsAnalyticsService,
    CustomerTopicsAnalyticsService,
    CustomerSentimentAnalyticsService,
    CustomerUsageAnalyticsService,
    CustomerAgentResourcesAnalyticsService,
  ],
  exports: [
    AnalyticsService,
    CustomerChatsAnalyticsService,
    CustomerLeadsAnalyticsService,
    CustomerTopicsAnalyticsService,
    CustomerSentimentAnalyticsService,
    CustomerUsageAnalyticsService,
    CustomerAgentResourcesAnalyticsService,
  ],
})
export class AnalyticsModule { }
