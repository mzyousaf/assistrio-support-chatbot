import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule as AppConfigModule } from '../config/config.module';
import { shouldRegisterKbInProcessCronsForWorkerApp } from '../config/app-mode.util';
import { MongooseDbModule } from '../db/mongoose.module';
import { HealthController } from '../health.controller';
import { IngestionModule } from '../ingestion/ingestion.module';
import { SummaryJobModule } from '../chat/summary-job.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { OnboardingKbTransferModule } from '../workspace/onboarding-kb-transfer.module';
import { JobsCronService } from './jobs-cron.service';

const registerKbCrons = shouldRegisterKbInProcessCronsForWorkerApp();

/**
 * Dedicated **worker** process (`APP_MODE=worker`): KB document ingestion + conversation summary crons.
 * No workspace/auth/widget HTTP surface (use the monolith `AppModule` with `APP_MODE=api` for API traffic).
 */
@Module({
  imports: [
    ...(registerKbCrons ? [ScheduleModule.forRoot()] : []),
    AppConfigModule,
    MongooseDbModule,
    KnowledgeModule,
    OnboardingKbTransferModule,
    IngestionModule.forRoot({ registerHttpControllers: false }),
    SummaryJobModule,
  ],
  controllers: [HealthController],
  providers: [...(registerKbCrons ? [JobsCronService] : [])],
})
export class WorkerAppModule {}
