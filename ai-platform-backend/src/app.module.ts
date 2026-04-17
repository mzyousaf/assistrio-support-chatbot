import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { MongooseDbModule } from './db/mongoose.module';
import { HealthController } from './health.controller';
import { WorkspaceModule } from './workspace/workspace.module';
import { BotsModule } from './bots/bots.module';
import { DocumentsModule } from './documents/documents.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ChatModule } from './chat/chat.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { VisitorsModule } from './visitors/visitors.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { JobsCronService } from './worker/jobs-cron.service';
import { InternalModule } from './internal/internal.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AppConfigModule,
    MongooseDbModule,
    InternalModule,
    RateLimitModule,
    KnowledgeModule,
    WorkspaceModule,
    BotsModule,
    DocumentsModule,
    IngestionModule,
    ChatModule,
    AnalyticsModule,
    VisitorsModule,
  ],
  controllers: [HealthController],
  providers: [JobsCronService],
})
export class AppModule { }
