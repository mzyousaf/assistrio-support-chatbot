import { Module } from '@nestjs/common';
import { BotsModule } from '../bots/bots.module';
import { ChatModule } from '../chat/chat.module';
import { DocumentsModule } from '../documents/documents.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AuthModule } from '../auth/auth.module';
import { UserBotsController } from './user-bots.controller';
import { UserSeedController } from './user-seed.controller';
import { UserChatController } from './user-chat.controller';
import { UserDocumentsController } from './user-documents.controller';
import { UserJobsController } from './user-jobs.controller';
import { UserOpenAiController } from './user-openai.controller';
import { BotOnboardingService } from './bot-onboarding.service';

@Module({
  imports: [
    AuthModule,
    BotsModule,
    ChatModule,
    DocumentsModule,
    IngestionModule,
    KnowledgeModule,
  ],
  controllers: [
    UserBotsController,
    UserSeedController,
    UserChatController,
    UserDocumentsController,
    UserJobsController,
    UserOpenAiController,
  ],
  providers: [BotOnboardingService],
  exports: [],
})
export class UserModule {}
