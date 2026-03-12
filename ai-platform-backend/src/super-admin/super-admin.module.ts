import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SuperAdminUser, SuperAdminUserSchema } from '../models';
import { BotsModule } from '../bots/bots.module';
import { ChatModule } from '../chat/chat.module';
import { DocumentsModule } from '../documents/documents.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { KbModule } from '../kb/kb.module';
import { LimitsModule } from '../limits/limits.module';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminBotsController } from './super-admin-bots.controller';
import { SuperAdminChatController } from './super-admin-chat.controller';
import { SuperAdminDocumentChunksController } from './super-admin-document-chunks.controller';
import { SuperAdminDocumentsController } from './super-admin-documents.controller';
import { SuperAdminJobsController } from './super-admin-jobs.controller';
import { SuperAdminLimitsController } from './super-admin-limits.controller';
import { SuperAdminOpenaiController } from './super-admin-openai.controller';
import { SuperAdminSeedController } from './super-admin-seed.controller';
import { SuperAdminUploadController } from './super-admin-upload.controller';
import { SuperAdminGuard } from './super-admin.guard';
import { SuperAdminLoginController } from './super-admin-login.controller';
import { BotOnboardingService } from './bot-onboarding.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwtSecret'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: SuperAdminUser.name, schema: SuperAdminUserSchema },
    ]),
    BotsModule,
    ChatModule,
    DocumentsModule,
    EmbeddingModule,
    IngestionModule,
    KbModule,
    LimitsModule,
  ],
  controllers: [
    SuperAdminLoginController,
    SuperAdminBotsController,
    SuperAdminChatController,
    SuperAdminDocumentChunksController,
    SuperAdminLimitsController,
    SuperAdminDocumentsController,
    SuperAdminJobsController,
    SuperAdminOpenaiController,
    SuperAdminSeedController,
    SuperAdminUploadController,
  ],
  providers: [SuperAdminAuthService, SuperAdminGuard, BotOnboardingService],
  exports: [SuperAdminAuthService, SuperAdminGuard],
})
export class SuperAdminModule {}
