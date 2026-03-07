import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BotsModule } from '../bots/bots.module';
import { ChatModule } from '../chat/chat.module';
import { DocumentsModule } from '../documents/documents.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { KbModule } from '../kb/kb.module';
import { LimitsModule } from '../limits/limits.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { TrialBotController } from './trial-bot.controller';
import { TrialCreateBotController } from './trial-create-bot.controller';
import { TrialChatController } from './trial-chat.controller';
import { TrialDocumentsController } from './trial-documents.controller';
import { TrialService } from './trial.service';

@Module({
  imports: [
    BotsModule,
    VisitorsModule,
    AnalyticsModule,
    DocumentsModule,
    IngestionModule,
    KbModule,
    ChatModule,
    LimitsModule,
    RateLimitModule,
  ],
  controllers: [
    TrialBotController,
    TrialCreateBotController,
    TrialChatController,
    TrialDocumentsController,
  ],
  providers: [TrialService],
  exports: [TrialService],
})
export class TrialModule {}
