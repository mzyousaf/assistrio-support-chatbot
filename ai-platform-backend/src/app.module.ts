import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { shouldRegisterKbInProcessCronsForAppModule } from './config/app-mode.util';
import { MongooseDbModule } from './db/mongoose.module';
import { HealthController } from './health.controller';
import { WorkspaceModule } from './workspace/workspace.module';
import { BotsModule } from './bots/bots.module';
import { DocumentsModule } from './documents/documents.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ChatModule } from './chat/chat.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TopicSentimentClassificationModule } from './analytics/topic-sentiment-classification.module';
import { VisitorsModule } from './visitors/visitors.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { OnboardingKbTransferModule } from './workspace/onboarding-kb-transfer.module';
import { JobsCronService } from './worker/jobs-cron.service';
import { InternalModule } from './internal/internal.module';
import { AdminCustomersModule } from './admin-customers/admin-customers.module';
import { AdminPlatformBotsModule } from './admin-platform-bots/admin-platform-bots.module';

const registerKbCrons = shouldRegisterKbInProcessCronsForAppModule();

@Module({
  imports: [
    ...(registerKbCrons ? [ScheduleModule.forRoot()] : []),
    AppConfigModule,
    MongooseDbModule,
    InternalModule,
    AdminCustomersModule,
    AdminPlatformBotsModule,
    RateLimitModule,
    KnowledgeModule,
    OnboardingKbTransferModule,
    WorkspaceModule,
    BotsModule,
    DocumentsModule,
    IngestionModule.forRoot({ registerHttpControllers: true }),
    ChatModule,
    AnalyticsModule,
    TopicSentimentClassificationModule,
    VisitorsModule,
  ],
  controllers: [HealthController],
  providers: [...(registerKbCrons ? [JobsCronService] : [])],
})
export class AppModule {}
