import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { MongooseDbModule } from './db/mongoose.module';
import { HealthController } from './health.controller';
import { UserModule } from './user/user.module';
import { BotsModule } from './bots/bots.module';
import { DocumentsModule } from './documents/documents.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ChatModule } from './chat/chat.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { JobsCronService } from './worker/jobs-cron.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AppConfigModule,
    MongooseDbModule,
    KnowledgeModule,
    UserModule,
    BotsModule,
    DocumentsModule,
    IngestionModule,
    ChatModule,
  ],
  controllers: [HealthController],
  providers: [JobsCronService],
})
export class AppModule {}
