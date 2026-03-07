import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { MongooseDbModule } from './db/mongoose.module';
import { HealthController } from './health.controller';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { BotsModule } from './bots/bots.module';
import { DocumentsModule } from './documents/documents.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ChatModule } from './chat/chat.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { VisitorsModule } from './visitors/visitors.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { LimitsModule } from './limits/limits.module';
import { DemoModule } from './demo/demo.module';
import { TrialModule } from './trial/trial.module';
import { JobsCronService } from './worker/jobs-cron.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AppConfigModule,
    MongooseDbModule,
    RateLimitModule,
    LimitsModule,
    SuperAdminModule,
    BotsModule,
    DemoModule,
    TrialModule,
    DocumentsModule,
    IngestionModule,
    ChatModule,
    AnalyticsModule,
    VisitorsModule,
  ],
  controllers: [HealthController],
  providers: [JobsCronService],
})
export class AppModule {}
