import { Module } from '@nestjs/common';
import { ConfigModule as AppConfigModule } from '../config/config.module';
import { MongooseDbModule } from '../db/mongoose.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { HealthController } from '../health.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { RuntimeAuthCoreModule } from './runtime-auth-core.module';
import { VisitorsRuntimeModule } from './visitors-runtime.module';
import { RuntimeBotsReadModule } from './runtime-bots-read.module';
import { RuntimeChatModule } from './runtime-chat.module';
import { RuntimeAnalyticsTrackModule } from './runtime-analytics-track.module';

/**
 * Lean HTTP app for public embed + preview + analytics write (`APP_MODE=runtime`).
 * — No `ScheduleModule`, `JobsCronService`, or ingestion job HTTP surface.
 * — No workspace customer/admin CRUD, documents upload, or internal admin routes.
 * — Same CORS and multipart body limits as `AppModule` (see `main.ts` bootstrap).
 */
@Module({
  imports: [
    AppConfigModule,
    MongooseDbModule,
    RateLimitModule,
    RuntimeAuthCoreModule,
    WorkspacesModule,
    VisitorsRuntimeModule,
    RuntimeBotsReadModule,
    RuntimeChatModule,
    RuntimeAnalyticsTrackModule,
  ],
  controllers: [HealthController],
})
export class RuntimeAppModule {}
