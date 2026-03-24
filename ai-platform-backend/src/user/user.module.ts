import { Module } from '@nestjs/common';
import { BotsModule } from '../bots/bots.module';
import { ChatModule } from '../chat/chat.module';
import { DocumentsModule } from '../documents/documents.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LimitsModule } from '../limits/limits.module';
import { AuthModule } from '../auth/auth.module';
import { UserBotsController } from './user-bots.controller';
import { UserSeedController } from './user-seed.controller';
import { UserChatController } from './user-chat.controller';
import { UserDocumentsController } from './user-documents.controller';
import { UserJobsController } from './user-jobs.controller';
import { UserLimitsController } from './user-limits.controller';
import { BotOnboardingService } from './bot-onboarding.service';

@Module({
  imports: [
    AuthModule,
    BotsModule,
    ChatModule,
    DocumentsModule,
    IngestionModule,
    KnowledgeModule,
    LimitsModule,
  ],
  controllers: [
    UserBotsController,
    UserSeedController,
    UserChatController,
    UserDocumentsController,
    UserJobsController,
    UserLimitsController,
  ],
  providers: [BotOnboardingService],
  exports: [],
})
export class UserModule { }
