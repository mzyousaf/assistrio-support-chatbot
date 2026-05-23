import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OnboardingKbTransferJob,
  OnboardingKbTransferJobSchema,
  WorkspaceOnboardingDraft,
  WorkspaceOnboardingDraftSchema,
  WorkspaceOnboardingKnowledgeStaging,
  WorkspaceOnboardingKnowledgeStagingSchema,
} from '../models';
import { DocumentsModule } from '../documents/documents.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { WorkspaceOnboardingKnowledgeTransferService } from './workspace-onboarding-knowledge-transfer.service';
import { WorkspaceOnboardingKbTransferJobService } from './workspace-onboarding-kb-transfer-job.service';

@Module({
  imports: [
    WorkspacesModule,
    KnowledgeModule,
    DocumentsModule,
    IngestionModule.forRoot({ registerHttpControllers: false }),
    MongooseModule.forFeature([
      { name: OnboardingKbTransferJob.name, schema: OnboardingKbTransferJobSchema },
      { name: WorkspaceOnboardingDraft.name, schema: WorkspaceOnboardingDraftSchema },
      { name: WorkspaceOnboardingKnowledgeStaging.name, schema: WorkspaceOnboardingKnowledgeStagingSchema },
    ]),
  ],
  providers: [WorkspaceOnboardingKnowledgeTransferService, WorkspaceOnboardingKbTransferJobService],
  exports: [WorkspaceOnboardingKnowledgeTransferService, WorkspaceOnboardingKbTransferJobService],
})
export class OnboardingKbTransferModule {}
