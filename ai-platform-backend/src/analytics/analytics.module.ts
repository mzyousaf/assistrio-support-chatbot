import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bot, BotSchema, Visitor, VisitorSchema, VisitorEvent, VisitorEventSchema } from '../models';
import { SuperAdminModule } from '../super-admin/super-admin.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsTrackController } from './analytics-track.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    SuperAdminModule,
    MongooseModule.forFeature([
      { name: VisitorEvent.name, schema: VisitorEventSchema },
      { name: Visitor.name, schema: VisitorSchema },
      { name: Bot.name, schema: BotSchema },
    ]),
    VisitorsModule,
  ],
  controllers: [AnalyticsController, AnalyticsTrackController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
