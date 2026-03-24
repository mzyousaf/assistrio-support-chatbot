import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Bot,
  BotSchema,
  Conversation,
  ConversationSchema,
  Visitor,
  VisitorSchema,
  VisitorEvent,
  VisitorEventSchema,
} from '../models';
import { AuthModule } from '../auth/auth.module';
import { VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Visitor.name, schema: VisitorSchema },
      { name: VisitorEvent.name, schema: VisitorEventSchema },
      { name: Bot.name, schema: BotSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
  ],
  controllers: [VisitorsController],
  providers: [VisitorsService],
  exports: [VisitorsService],
})
export class VisitorsModule { }
