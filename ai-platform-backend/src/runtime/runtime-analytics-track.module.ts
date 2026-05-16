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
import { DocumentsModule } from '../documents/documents.module';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsTrackController } from '../analytics/analytics-track.controller';
import { VisitorsRuntimeModule } from './visitors-runtime.module';

/**
 * `POST /api/analytics/track` only (append-only event ingestion), without admin analytics controllers.
 * `AnalyticsService` is shared with the monolith; `DocumentsModule` satisfies its constructor
 * (admin/reporting paths are unused at runtime for this process).
 */
@Module({
  imports: [
    DocumentsModule,
    VisitorsRuntimeModule,
    MongooseModule.forFeature([
      { name: VisitorEvent.name, schema: VisitorEventSchema },
      { name: Visitor.name, schema: VisitorSchema },
      { name: Bot.name, schema: BotSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  controllers: [AnalyticsTrackController],
  providers: [AnalyticsService],
})
export class RuntimeAnalyticsTrackModule {}
