import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TranscriptionModule } from '../transcription/transcription.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { EmailModule } from '../email/email.module';
import {
  User,
  UserSchema,
  Workspace,
  WorkspaceSchema,
  WorkspaceInvite,
  WorkspaceInviteSchema,
  WorkspaceMembership,
  WorkspaceMembershipSchema,
  WorkspaceOnboardingDraft,
  WorkspaceOnboardingDraftSchema,
  WorkspaceOnboardingKnowledgeStaging,
  WorkspaceOnboardingKnowledgeStagingSchema,
  WorkspaceBotAccessGrant,
  WorkspaceBotAccessGrantSchema,
} from '../models';
import { WorkspaceInviteService } from './workspace-invite.service';
import { WorkspaceBotAccessGrantService } from './workspace-bot-access-grant.service';
import { WorkspaceInviteEmailService } from './workspace-invite-email.service';
import { WorkspaceInviteDeliveryService } from './workspace-invite-delivery.service';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { WorkspaceOnboardingKnowledgeStagingService } from './workspace-onboarding-knowledge-staging.service';
import { WorkspaceOnboardingKnowledgeContentService } from './workspace-onboarding-knowledge-content.service';
import { WorkspaceOnboardingDictationService } from './workspace-onboarding-dictation.service';

@Module({
  imports: [
    TranscriptionModule,
    EntitlementsModule,
    EmailModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: WorkspaceMembership.name, schema: WorkspaceMembershipSchema },
      { name: WorkspaceInvite.name, schema: WorkspaceInviteSchema },
      { name: WorkspaceBotAccessGrant.name, schema: WorkspaceBotAccessGrantSchema },
      { name: WorkspaceOnboardingDraft.name, schema: WorkspaceOnboardingDraftSchema },
      { name: WorkspaceOnboardingKnowledgeStaging.name, schema: WorkspaceOnboardingKnowledgeStagingSchema },
    ]),
  ],
  providers: [
    WorkspacesService,
    WorkspaceInviteService,
    WorkspaceBotAccessGrantService,
    WorkspaceInviteEmailService,
    WorkspaceInviteDeliveryService,
    WorkspaceOnboardingService,
    WorkspaceOnboardingKnowledgeStagingService,
    WorkspaceOnboardingKnowledgeContentService,
    WorkspaceOnboardingDictationService,
  ],
  exports: [
    WorkspacesService,
    WorkspaceInviteService,
    WorkspaceBotAccessGrantService,
    WorkspaceInviteEmailService,
    WorkspaceInviteDeliveryService,
    WorkspaceOnboardingService,
    WorkspaceOnboardingKnowledgeStagingService,
    WorkspaceOnboardingKnowledgeContentService,
    WorkspaceOnboardingDictationService,
  ],
})
export class WorkspacesModule {}
