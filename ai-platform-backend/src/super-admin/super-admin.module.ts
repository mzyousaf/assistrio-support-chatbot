import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SuperAdminUser, SuperAdminUserSchema } from '../models';
import { BotsModule } from '../bots/bots.module';
import { ChatModule } from '../chat/chat.module';
import { DocumentsModule } from '../documents/documents.module';
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
import { SuperAdminUploadsController } from './super-admin-uploads.controller';
import { SuperAdminGuard } from './super-admin.guard';
import { SuperAdminLoginController } from './super-admin-login.controller';

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
    SuperAdminUploadsController,
  ],
  providers: [SuperAdminAuthService, SuperAdminGuard],
  exports: [SuperAdminAuthService, SuperAdminGuard],
})
export class SuperAdminModule {}
