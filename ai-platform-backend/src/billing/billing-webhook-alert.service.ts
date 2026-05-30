import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { BillingWebhookEventsService } from './billing-webhook-events.service';

@Injectable()
export class BillingWebhookAlertService {
  private readonly logger = new Logger(BillingWebhookAlertService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly webhookEventsService: BillingWebhookEventsService,
  ) {}

  async notifyWebhookFailure(input: {
    eventId: string;
    eventName: string;
    provider: string;
    workspaceId?: string | null;
    processingError: string;
    createdAt?: Date | null;
  }): Promise<void> {
    const alertEmail = this.configService.get<string>('billingAlertEmail')?.trim() ?? '';
    if (!alertEmail) {
      this.logger.warn('Skipping billing webhook alert — BILLING_ALERT_EMAIL is not configured.');
      return;
    }

    const event = await this.webhookEventsService.findById(input.eventId);
    if (!event) return;
    if (event.alertedAt) return;

    const workspaceId = input.workspaceId?.trim() || (event.workspaceId ? String(event.workspaceId) : null);
    const adminAppBaseUrl = this.configService.get<string>('adminAppBaseUrl')?.trim().replace(/\/$/, '') ?? '';
    const replayLink = adminAppBaseUrl && workspaceId
      ? `${adminAppBaseUrl}/customers?workspaceId=${encodeURIComponent(workspaceId)}&webhookEventId=${encodeURIComponent(input.eventId)}`
      : null;

    const createdAtLabel = (input.createdAt ?? event.receivedAt ?? new Date()).toISOString();
    const subject = 'Billing webhook failed';
    const lines = [
      'A billing webhook failed to process.',
      '',
      `Event: ${input.eventName}`,
      `Provider: ${input.provider}`,
      `Event ID: ${input.eventId}`,
      `Workspace ID: ${workspaceId ?? 'unknown'}`,
      `Error: ${input.processingError}`,
      `Created at: ${createdAtLabel}`,
    ];
    if (replayLink) {
      lines.push('', `Admin replay: ${replayLink}`);
    } else if (workspaceId) {
      lines.push('', `Replay via POST /api/admin/billing/webhook-events/${input.eventId}/replay`);
    }

    const text = lines.join('\n');
    const html = lines.map((line) => (line ? `<p>${line}</p>` : '<br />')).join('');

    const sendResult = await this.emailService.send({
      to: alertEmail,
      subject,
      html,
      text,
    });

    if (!sendResult.ok) {
      this.logger.warn(
        `Billing webhook alert email not sent for event ${input.eventId}: ${sendResult.message}`,
      );
      return;
    }

    await this.webhookEventsService.markAlertSent(input.eventId);
  }
}
