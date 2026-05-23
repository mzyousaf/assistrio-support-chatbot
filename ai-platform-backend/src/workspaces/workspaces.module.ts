import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TranscriptionModule } from '../transcription/transcription.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import {
  User,
  UserSchema,
  Workspace,
  WorkspaceSchema,
  WorkspaceMembership,
  WorkspaceMembershipSchema,
  WorkspaceOnboardingDraft,
  WorkspaceOnboardingDraftSchema,
  WorkspaceOnboardingKnowledgeStaging,
  WorkspaceOnboardingKnowledgeStagingSchema,
} from '../models';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { WorkspaceOnboardingKnowledgeStagingService } from './workspace-onboarding-knowledge-staging.service';
import { WorkspaceOnboardingKnowledgeContentService } from './workspace-onboarding-knowledge-content.service';
import { WorkspaceOnboardingDictationService } from './workspace-onboarding-dictation.service';

@Module({
  imports: [
    TranscriptionModule,
    EntitlementsModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: WorkspaceMembership.name, schema: WorkspaceMembershipSchema },
      { name: WorkspaceOnboardingDraft.name, schema: WorkspaceOnboardingDraftSchema },
      { name: WorkspaceOnboardingKnowledgeStaging.name, schema: WorkspaceOnboardingKnowledgeStagingSchema },
    ]),
  ],
  providers: [WorkspacesService, WorkspaceOnboardingService, WorkspaceOnboardingKnowledgeStagingService, WorkspaceOnboardingKnowledgeContentService, WorkspaceOnboardingDictationService],
  exports: [WorkspacesService, WorkspaceOnboardingService, WorkspaceOnboardingKnowledgeStagingService, WorkspaceOnboardingKnowledgeContentService, WorkspaceOnboardingDictationService],
})
export class WorkspacesModule {}
