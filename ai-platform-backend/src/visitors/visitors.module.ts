import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Visitor, VisitorSchema, VisitorEvent, VisitorEventSchema } from '../models';
import { AuthModule } from '../auth/auth.module';
import { AdminVisitorsController } from './admin-visitors.controller';
import { VisitorsService } from './visitors.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Visitor.name, schema: VisitorSchema },
      { name: VisitorEvent.name, schema: VisitorEventSchema },
    ]),
  ],
  controllers: [AdminVisitorsController],
  providers: [VisitorsService],
  exports: [VisitorsService],
})
export class VisitorsModule { }
