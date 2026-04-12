import { Module } from '@nestjs/common';
import { BotsModule } from '../bots/bots.module';
import { ChatModule } from '../chat/chat.module';
import { DocumentsModule } from '../documents/documents.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UserBotsController } from './user-bots.controller';
import { UserSeedController } from './user-seed.controller';
import { UserChatController } from './user-chat.controller';
import { UserDocumentsController } from './user-documents.controller';
import { UserJobsController } from './user-jobs.controller';
import { BotOnboardingService } from './bot-onboarding.service';
import { ShowcaseAgentsPackService } from './showcase-agents-pack.service';

@Module({
  imports: [
    AuthModule,
    WorkspacesModule,
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
  ],
  providers: [BotOnboardingService, ShowcaseAgentsPackService],
  exports: [],
})
export class UserModule { }
