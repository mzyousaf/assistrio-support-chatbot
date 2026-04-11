import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Bot,
  BotSchema,
  Conversation,
  ConversationSchema,
  Message,
  MessageSchema,
  TrialAccessToken,
  TrialAccessTokenSchema,
  TrialDashboardSession,
  TrialDashboardSessionSchema,
  TrialEmailWorkspace,
  TrialEmailWorkspaceSchema,
  TrialOnboardingDraft,
  TrialOnboardingDraftSchema,
  Visitor,
  VisitorSchema,
  VisitorEvent,
  VisitorEventSchema,
} from '../models';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { LandingSiteApiKeyModule } from '../landing-site-api-key/landing-site-api-key.module';
import { LandingContactController } from './landing-contact.controller';
import { LandingTrialAccessController } from './landing-trial-access.controller';
import { LandingTrialDraftController } from './landing-trial-draft.controller';
import { LandingTrialUploadController } from './landing-trial-upload.controller';
import { LandingTrialVerifyController } from './landing-trial-verify.controller';
import { VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';

@Module({
  imports: [
    AuthModule,
    EmailModule,
    LandingSiteApiKeyModule,
    MongooseModule.forFeature([
      { name: Visitor.name, schema: VisitorSchema },
      { name: VisitorEvent.name, schema: VisitorEventSchema },
      { name: Bot.name, schema: BotSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: TrialAccessToken.name, schema: TrialAccessTokenSchema },
      { name: TrialDashboardSession.name, schema: TrialDashboardSessionSchema },
      { name: TrialEmailWorkspace.name, schema: TrialEmailWorkspaceSchema },
      { name: TrialOnboardingDraft.name, schema: TrialOnboardingDraftSchema },
    ]),
  ],
  controllers: [
    VisitorsController,
    LandingTrialAccessController,
    LandingTrialDraftController,
    LandingTrialUploadController,
    LandingTrialVerifyController,
    LandingContactController,
  ],
  providers: [VisitorsService],
  exports: [VisitorsService],
})
export class VisitorsModule { }
