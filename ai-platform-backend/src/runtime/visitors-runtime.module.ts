import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Visitor, VisitorSchema, VisitorEvent, VisitorEventSchema } from '../models';
import { VisitorsService } from '../visitors/visitors.service';

/**
 * Visitor + funnel persistence for chat init and `POST /api/analytics/track` without
 * `VisitorsModule` (which also registers the admin `AdminVisitorsController`).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Visitor.name, schema: VisitorSchema },
      { name: VisitorEvent.name, schema: VisitorEventSchema },
    ]),
  ],
  providers: [VisitorsService],
  exports: [VisitorsService, MongooseModule],
})
export class VisitorsRuntimeModule {}
