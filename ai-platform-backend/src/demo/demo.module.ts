import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BotsModule } from '../bots/bots.module';
import { ChatModule } from '../chat/chat.module';
import { LimitsModule } from '../limits/limits.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { DemoChatController } from './demo-chat.controller';

@Module({
  imports: [
    BotsModule,
    VisitorsModule,
    LimitsModule,
    RateLimitModule,
    ChatModule,
    AnalyticsModule,
  ],
  controllers: [DemoChatController],
})
export class DemoModule {}
