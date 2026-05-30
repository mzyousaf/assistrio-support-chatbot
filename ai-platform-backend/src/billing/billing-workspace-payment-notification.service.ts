import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EmailService } from '../email/email.service';
import { User, Workspace, WorkspaceMembership, WorkspaceSubscription } from '../models';
import { getPlanByKey } from '../entitlements/plan-catalog';
import { BillingManageService } from './billing-manage.service';
import type { BillingWebhookAction } from './billing-provider.types';

@Injectable()
export class BillingWorkspacePaymentNotificationService {
  private readonly logger = new Logger(BillingWorkspacePaymentNotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly billingManageService: BillingManageService,
    @InjectModel(WorkspaceSubscription.name)
    private readonly subscriptionModel: Model<WorkspaceSubscription>,
    @InjectModel(WorkspaceMembership.name)
    private readonly membershipModel: Model<WorkspaceMembership>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
  ) {}

  async handleWebhookProcessed(input: {
    webhookEventId: string;
    eventName: string;
    actions: BillingWebhookAction[];
    preSyncHadPaymentFailureByWorkspace?: Record<string, boolean>;
  }): Promise<void> {
    const normalizedEvent = input.eventName.trim().toLowerCase().replace(/-/g, '_');

    for (const action of input.actions) {
      if (action.kind !== 'subscription_sync') continue;

      if (normalizedEvent === 'subscription_payment_failed') {
        await this.notifyPaymentFailed({
          webhookEventId: input.webhookEventId,
          workspaceId: action.workspaceId,
          paymentFailure: action.paymentFailure,
        });
        continue;
      }

      if (
        normalizedEvent === 'subscription_payment_success' ||
        normalizedEvent === 'subscription_payment_recovered' ||
        normalizedEvent === 'subscription_resumed'
      ) {
        if (action.clearPaymentFailure) {
          const hadFailure = input.preSyncHadPaymentFailureByWorkspace?.[action.workspaceId] ?? false;
          await this.notifyPaymentRecovered({
            webhookEventId: input.webhookEventId,
            workspaceId: action.workspaceId,
            hadPaymentFailure: hadFailure,
          });
        }

        if (normalizedEvent === 'subscription_payment_success') {
          await this.notifyPaymentReceiptIfEnabled({
            webhookEventId: input.webhookEventId,
            workspaceId: action.workspaceId,
          });
        }
      }
    }
  }

  async notifySubscriptionCancelScheduled(workspaceId: string): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId)) return;

    const subscription = await this.subscriptionModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId) })
      .exec();
    if (!subscription || !subscription.cancelAtPeriodEnd) return;
    if (subscription.subscriptionCancelEmailSentAt) return;

    const ownerEmail = await this.resolveOwnerEmail(workspaceId);
    if (!ownerEmail) return;

    const workspaceName = await this.resolveWorkspaceName(workspaceId);
    const planName = getPlanByKey(subscription.planKey).name;
    const periodEndLabel = this.formatPeriodEndLabel(subscription.currentPeriodEnd);
    const billingLink = this.billingSettingsUrl();

    const subject = 'Your Assistrio subscription is scheduled to cancel';
    const text = [
      `Your ${planName} subscription for ${workspaceName} is scheduled to cancel.`,
      `Your plan remains active until ${periodEndLabel}.`,
      'You can restore before that date from Billing & Invoices.',
      '',
      `Billing & Invoices: ${billingLink}`,
    ].join('\n');
    const html = [
      `<p>Your ${planName} subscription for <strong>${workspaceName}</strong> is scheduled to cancel.</p>`,
      `<p>Your plan remains active until <strong>${periodEndLabel}</strong>.</p>`,
      '<p>You can restore before that date from Billing &amp; Invoices.</p>',
      `<p><a href="${billingLink}">Billing &amp; Invoices</a></p>`,
    ].join('');

    const sendResult = await this.emailService.send({ to: ownerEmail, subject, html, text });
    if (!sendResult.ok) {
      this.logger.warn(
        `Subscription cancel email not sent for workspace ${workspaceId}: ${sendResult.message}`,
      );
      return;
    }

    await this.subscriptionModel.updateOne(
      { _id: subscription._id },
      { $set: { subscriptionCancelEmailSentAt: new Date() } },
    );
  }

  async notifySubscriptionRestored(workspaceId: string): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId)) return;

    const subscription = await this.subscriptionModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId) })
      .exec();
    if (!subscription) return;

    const restoredAt = subscription.subscriptionRestoredEmailSentAt;
    if (restoredAt && Date.now() - restoredAt.getTime() < 60_000) return;

    const ownerEmail = await this.resolveOwnerEmail(workspaceId);
    if (!ownerEmail) return;

    const workspaceName = await this.resolveWorkspaceName(workspaceId);
    const billingLink = this.billingSettingsUrl();

    const subject = 'Your Assistrio subscription has been restored';
    const text = [
      `Your subscription for ${workspaceName} is active again.`,
      '',
      `Billing & Invoices: ${billingLink}`,
    ].join('\n');
    const html = [
      `<p>Your subscription for <strong>${workspaceName}</strong> is active again.</p>`,
      `<p><a href="${billingLink}">Billing &amp; Invoices</a></p>`,
    ].join('');

    const sendResult = await this.emailService.send({ to: ownerEmail, subject, html, text });
    if (!sendResult.ok) {
      this.logger.warn(
        `Subscription restored email not sent for workspace ${workspaceId}: ${sendResult.message}`,
      );
      return;
    }

    await this.subscriptionModel.updateOne(
      { _id: subscription._id },
      {
        $set: {
          subscriptionRestoredEmailSentAt: new Date(),
          subscriptionCancelEmailSentAt: null,
        },
      },
    );
  }

  private async resolveOwnerEmail(workspaceId: string): Promise<string | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;

    const ownerMembership = await this.membershipModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId), role: 'owner' })
      .select('userId')
      .lean()
      .exec();

    if (!ownerMembership?.userId) return null;

    const owner = await this.userModel.findById(ownerMembership.userId).select('email').lean().exec();
    const email = owner?.email?.trim();
    return email || null;
  }

  private async resolveWorkspaceName(workspaceId: string): Promise<string> {
    if (!Types.ObjectId.isValid(workspaceId)) return 'your workspace';

    const workspace = await this.workspaceModel
      .findById(workspaceId)
      .select('name')
      .lean()
      .exec();
    const name = workspace?.name?.trim();
    return name || 'your workspace';
  }

  private billingSettingsUrl(): string {
    const base = this.configService.get<string>('customerAppBaseUrl')?.trim().replace(/\/$/, '') ?? '';
    const path = '/settings/billing';
    return base ? `${base}${path}` : path;
  }

  private formatPeriodEndLabel(periodEnd: Date | null | undefined): string {
    if (!periodEnd) return 'the end of your billing period';
    return periodEnd.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private formatFailedAmount(
    paymentFailure?: Extract<BillingWebhookAction, { kind: 'subscription_sync' }>['paymentFailure'],
    storedFailure?: WorkspaceSubscription['paymentFailure'],
  ): string | null {
    const amount = paymentFailure?.amount ?? storedFailure?.amount;
    const currency = (paymentFailure?.currency ?? storedFailure?.currency ?? 'USD').toUpperCase();
    if (amount == null || !Number.isFinite(amount)) return null;
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
    } catch {
      return `${amount / 100} ${currency}`;
    }
  }

  private async resolveManageBillingLink(workspaceId: string): Promise<string> {
    try {
      const session = await this.billingManageService.createManageBillingUrl(workspaceId);
      return session.url?.trim() || this.billingSettingsUrl();
    } catch {
      return this.billingSettingsUrl();
    }
  }

  private async notifyPaymentFailed(input: {
    webhookEventId: string;
    workspaceId: string;
    paymentFailure?: Extract<BillingWebhookAction, { kind: 'subscription_sync' }>['paymentFailure'];
  }): Promise<void> {
    if (!Types.ObjectId.isValid(input.workspaceId)) return;

    const subscription = await this.subscriptionModel
      .findOne({ workspaceId: new Types.ObjectId(input.workspaceId) })
      .exec();

    if (!subscription) return;

    const failure = subscription.paymentFailure;
    const invoiceId = input.paymentFailure?.invoiceId?.trim() || failure?.invoiceId?.trim() || null;

    if (failure?.notifiedWebhookEventId === input.webhookEventId) return;
    if (invoiceId && failure?.notifiedInvoiceId === invoiceId) return;

    const ownerEmail = await this.resolveOwnerEmail(input.workspaceId);
    if (!ownerEmail) {
      this.logger.warn(`Skipping payment failed email — no owner email for workspace ${input.workspaceId}`);
      return;
    }

    const workspaceName = await this.resolveWorkspaceName(input.workspaceId);
    const planName = getPlanByKey(subscription.planKey).name;
    const failedAmount = this.formatFailedAmount(input.paymentFailure, failure);
    const billingLink = this.billingSettingsUrl();

    const subject = 'Payment failed for your Assistrio workspace';
    const textLines = [
      'Your recent payment could not be completed.',
      'Please update your payment method in Billing & Invoices.',
      '',
      `Workspace: ${workspaceName}`,
      `Plan: ${planName}`,
    ];
    if (failedAmount) textLines.push(`Amount: ${failedAmount}`);
    textLines.push('', `Billing & Invoices: ${billingLink}`);

    const htmlParts = [
      '<p>Your recent payment could not be completed.</p>',
      '<p>Please update your payment method in Billing &amp; Invoices.</p>',
      `<p><strong>Workspace:</strong> ${workspaceName}<br />`,
      `<strong>Plan:</strong> ${planName}`,
    ];
    if (failedAmount) htmlParts.push(`<br /><strong>Amount:</strong> ${failedAmount}`);
    htmlParts.push('</p>', `<p><a href="${billingLink}">Billing &amp; Invoices</a></p>`);

    const sendResult = await this.emailService.send({
      to: ownerEmail,
      subject,
      html: htmlParts.join(''),
      text: textLines.join('\n'),
    });

    if (!sendResult.ok) {
      this.logger.warn(
        `Payment failed email not sent for workspace ${input.workspaceId}: ${sendResult.message}`,
      );
      return;
    }

    await this.subscriptionModel.updateOne(
      { _id: subscription._id },
      {
        $set: {
          'paymentFailure.notifiedWebhookEventId': input.webhookEventId,
          ...(invoiceId ? { 'paymentFailure.notifiedInvoiceId': invoiceId } : {}),
        },
      },
    );
  }

  private async notifyPaymentRecovered(input: {
    webhookEventId: string;
    workspaceId: string;
    hadPaymentFailure: boolean;
  }): Promise<void> {
    if (!Types.ObjectId.isValid(input.workspaceId)) return;
    if (!input.hadPaymentFailure) return;

    const subscription = await this.subscriptionModel
      .findOne({ workspaceId: new Types.ObjectId(input.workspaceId) })
      .select('lastPaymentRecoveryNotifiedWebhookEventId')
      .lean()
      .exec();

    if (!subscription) return;

    if (subscription.lastPaymentRecoveryNotifiedWebhookEventId === input.webhookEventId) {
      return;
    }

    const ownerEmail = await this.resolveOwnerEmail(input.workspaceId);
    if (!ownerEmail) return;

    const manageLink = await this.resolveManageBillingLink(input.workspaceId);
    const subject = 'Payment recovered for your Assistrio workspace';
    const text = [
      'Your subscription payment was successful and your workspace billing is active again.',
      '',
      `Manage billing: ${manageLink}`,
    ].join('\n');
    const html = [
      '<p>Your subscription payment was successful and your workspace billing is active again.</p>',
      `<p><a href="${manageLink}">Manage billing</a></p>`,
    ].join('');

    const sendResult = await this.emailService.send({ to: ownerEmail, subject, html, text });
    if (!sendResult.ok) {
      this.logger.warn(
        `Payment recovery email not sent for workspace ${input.workspaceId}: ${sendResult.message}`,
      );
      return;
    }

    await this.subscriptionModel.updateOne(
      { _id: subscription._id },
      { $set: { lastPaymentRecoveryNotifiedWebhookEventId: input.webhookEventId } },
    );
  }

  private async notifyPaymentReceiptIfEnabled(input: {
    webhookEventId: string;
    workspaceId: string;
  }): Promise<void> {
    const enabled = this.configService.get<boolean>('sendAssistrioPaymentReceiptEmail') ?? false;
    if (!enabled) return;
    if (!Types.ObjectId.isValid(input.workspaceId)) return;

    const subscription = await this.subscriptionModel
      .findOne({ workspaceId: new Types.ObjectId(input.workspaceId) })
      .select('lastPaymentReceiptEmailWebhookEventId planKey')
      .lean()
      .exec();
    if (!subscription) return;
    if (subscription.lastPaymentReceiptEmailWebhookEventId === input.webhookEventId) return;

    const ownerEmail = await this.resolveOwnerEmail(input.workspaceId);
    if (!ownerEmail) return;

    const workspaceName = await this.resolveWorkspaceName(input.workspaceId);
    const billingLink = this.billingSettingsUrl();
    const subject = 'Payment received for your Assistrio workspace';
    const text = [
      `We received your payment for ${workspaceName}.`,
      '',
      `Billing & Invoices: ${billingLink}`,
    ].join('\n');
    const html = [
      `<p>We received your payment for <strong>${workspaceName}</strong>.</p>`,
      `<p><a href="${billingLink}">Billing &amp; Invoices</a></p>`,
    ].join('');

    const sendResult = await this.emailService.send({ to: ownerEmail, subject, html, text });
    if (!sendResult.ok) {
      this.logger.warn(
        `Payment receipt email not sent for workspace ${input.workspaceId}: ${sendResult.message}`,
      );
      return;
    }

    await this.subscriptionModel.updateOne(
      { workspaceId: new Types.ObjectId(input.workspaceId) },
      { $set: { lastPaymentReceiptEmailWebhookEventId: input.webhookEventId } },
    );
  }
}
