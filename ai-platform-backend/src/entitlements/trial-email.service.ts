import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EmailService } from '../email/email.service';
import { User, Workspace, WorkspaceMembership, WorkspaceSubscription } from '../models';
import {
  buildTrialCreditsUsedEmail,
  buildTrialEndingSoonEmail,
  buildTrialExpiredEmail,
  buildTrialStartedEmail,
} from './trial-email.template';

type TrialEmailKind =
  | 'started'
  | 'ending_soon'
  | 'expired'
  | 'credits_used';

const SENT_AT_FIELD: Record<TrialEmailKind, keyof WorkspaceSubscription> = {
  started: 'trialStartedEmailSentAt',
  ending_soon: 'trialEndingSoonEmailSentAt',
  expired: 'trialExpiredEmailSentAt',
  credits_used: 'trialCreditsUsedEmailSentAt',
};

@Injectable()
export class TrialEmailService {
  private readonly logger = new Logger(TrialEmailService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    @InjectModel(WorkspaceSubscription.name)
    private readonly subscriptionModel: Model<WorkspaceSubscription>,
    @InjectModel(WorkspaceMembership.name)
    private readonly membershipModel: Model<WorkspaceMembership>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
  ) {}

  async notifyTrialStarted(workspaceId: string): Promise<void> {
    await this.sendOnce(workspaceId, 'started', ({ workspaceName, trialEndLabel }) =>
      buildTrialStartedEmail({
        workspaceName,
        trialEndLabel,
        appUrl: this.appBaseUrl(),
        billingUrl: this.billingSettingsUrl(),
      }),
    );
  }

  async notifyTrialEndingSoon(workspaceId: string, trialEnd: Date): Promise<void> {
    await this.sendOnce(workspaceId, 'ending_soon', ({ workspaceName }) =>
      buildTrialEndingSoonEmail({
        workspaceName,
        trialEndLabel: this.formatPeriodEndLabel(trialEnd),
        billingUrl: this.billingSettingsUrl(),
      }),
    );
  }

  async notifyTrialExpired(workspaceId: string): Promise<void> {
    await this.sendOnce(workspaceId, 'expired', ({ workspaceName }) =>
      buildTrialExpiredEmail({
        workspaceName,
        billingUrl: this.billingSettingsUrl(),
      }),
    );
  }

  async notifyTrialCreditsUsed(workspaceId: string): Promise<void> {
    await this.sendOnce(workspaceId, 'credits_used', ({ workspaceName }) =>
      buildTrialCreditsUsedEmail({
        workspaceName,
        billingUrl: this.billingSettingsUrl(),
      }),
    );
  }

  private async sendOnce(
    workspaceId: string,
    kind: TrialEmailKind,
    buildContent: (ctx: {
      workspaceName: string;
      trialEndLabel: string;
    }) => { subject: string; html: string; text: string },
  ): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId)) return;

    const subscription = await this.subscriptionModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId) })
      .exec();
    if (!subscription || !this.isFreeTrialSubscription(subscription)) return;

    const sentAtField = SENT_AT_FIELD[kind];
    if (subscription[sentAtField]) return;

    const ownerEmail = await this.resolveOwnerEmail(workspaceId);
    if (!ownerEmail) {
      this.logger.warn(`Skipping trial ${kind} email — no owner email for workspace ${workspaceId}`);
      return;
    }

    const workspaceName = await this.resolveWorkspaceName(workspaceId);
    const trialEndLabel = this.formatPeriodEndLabel(subscription.currentPeriodEnd);
    const content = buildContent({ workspaceName, trialEndLabel });

    const sendResult = await this.emailService.send({
      to: ownerEmail,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    if (!sendResult.ok) {
      this.logger.warn(
        `Trial ${kind} email not sent for workspace ${workspaceId}: ${sendResult.message}`,
      );
      return;
    }

    await this.subscriptionModel.updateOne(
      { _id: subscription._id, [sentAtField]: null },
      { $set: { [sentAtField]: new Date() } },
    );
  }

  isFreeTrialSubscription(
    subscription: Pick<WorkspaceSubscription, 'planKey' | 'status' | 'providerSubscriptionId'>,
  ): boolean {
    if (subscription.planKey !== 'free') return false;
    if (subscription.status !== 'trialing' && subscription.status !== 'free') return false;
    if (String(subscription.providerSubscriptionId ?? '').trim()) return false;
    return true;
  }

  hasActivePaidSubscription(
    subscription: Pick<WorkspaceSubscription, 'planKey' | 'status' | 'providerSubscriptionId'>,
  ): boolean {
    if (subscription.planKey !== 'starter' && subscription.planKey !== 'pro') return false;
    if (!String(subscription.providerSubscriptionId ?? '').trim()) return false;
    return subscription.status === 'active' || subscription.status === 'past_due' || subscription.status === 'trialing';
  }

  private async resolveOwnerEmail(workspaceId: string): Promise<string | null> {
    const membership = await this.membershipModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId), role: 'owner' })
      .select('userId')
      .lean()
      .exec();
    if (!membership?.userId) return null;

    const user = await this.userModel.findById(membership.userId).select('email').lean().exec();
    const email = String(user?.email ?? '').trim();
    return email || null;
  }

  private async resolveWorkspaceName(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceModel
      .findById(new Types.ObjectId(workspaceId))
      .select('name')
      .lean()
      .exec();
    return String(workspace?.name ?? 'Workspace').trim() || 'Workspace';
  }

  private appBaseUrl(): string {
    const base = String(this.configService.get<string>('customerAppBaseUrl') ?? '').trim();
    return base.replace(/\/$/, '') || 'https://app.assistrio.com';
  }

  private billingSettingsUrl(): string {
    return `${this.appBaseUrl()}/settings/billing`;
  }

  private formatPeriodEndLabel(periodEnd: Date | string | null | undefined): string {
    const date = periodEnd instanceof Date ? periodEnd : new Date(String(periodEnd ?? ''));
    if (Number.isNaN(date.getTime())) return 'the end of your trial';
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
