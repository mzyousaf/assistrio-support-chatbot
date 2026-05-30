import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspaceSubscription } from '../models/workspace-subscription.schema';
import { BillingProviderService } from './billing-provider.service';
import { BillingWebhookAlertService } from './billing-webhook-alert.service';
import { BillingWebhookEventsService } from './billing-webhook-events.service';
import { BillingWebhookProcessingService } from './billing-webhook-processing.service';
import { BillingWorkspacePaymentNotificationService } from './billing-workspace-payment-notification.service';
import type { BillingWebhookAction } from './billing-provider.types';
import {
  logBillingWebhookFailed,
  logBillingWebhookProcessed,
  logLemonWebhookReceived,
} from './billing-webhook-log.util';
import { extractWorkspaceIdFromWebhookPayload } from './billing-webhook-payload.util';
import {
  resolveWebhookRawBody,
  type FastifyRequestWithRawBody,
} from '../http/fastify-json-body.parser';

@Controller('api/billing/webhooks')
export class BillingWebhooksController {
  private readonly logger = new Logger(BillingWebhooksController.name);

  constructor(
    private readonly billingProviderService: BillingProviderService,
    private readonly webhookEventsService: BillingWebhookEventsService,
    private readonly webhookProcessingService: BillingWebhookProcessingService,
    private readonly paymentNotificationService: BillingWorkspacePaymentNotificationService,
    private readonly webhookAlertService: BillingWebhookAlertService,
    @InjectModel(WorkspaceSubscription.name)
    private readonly subscriptionModel: Model<WorkspaceSubscription>,
  ) {}

  @Post('lemon-squeezy')
  async handleLemonSqueezyWebhook(@Req() req: FastifyRequestWithRawBody) {
    const rawBody = resolveWebhookRawBody(req);

    logLemonWebhookReceived(this.logger, {
      hasRawBody: Boolean(rawBody?.length),
      rawBodyLength: rawBody?.length ?? 0,
      parsedBody: req.body,
    });

    if (!rawBody) {
      throw new BadRequestException({
        error: 'Raw request body is required for webhook signature verification.',
        errorCode: 'webhook_raw_body_missing',
      });
    }

    const headers: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      headers[key] = value;
    }

    if (!this.billingProviderService.verifyWebhookSignature(rawBody, headers)) {
      throw new UnauthorizedException({ error: 'Invalid webhook signature.' });
    }

    const event = this.billingProviderService.parseWebhook(rawBody, headers);
    const stored = await this.webhookEventsService.storeReceivedEvent(rawBody, event);
    const rawPayload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    const workspaceId = extractWorkspaceIdFromWebhookPayload(rawPayload);

    if (stored.isDuplicate) {
      return { received: true, duplicate: true, status: stored.status };
    }

    const mapped = await this.billingProviderService.mapWebhookEvent(event);
    const actions = Array.isArray(mapped) ? mapped : [mapped];

    if (this.isMissingWorkspaceFailure(actions)) {
      const processingError = 'missing_workspace_id in meta.custom_data';
      await this.webhookEventsService.markFailed(stored.id, processingError);
      logBillingWebhookFailed(this.logger, {
        eventId: stored.id,
        eventName: event.eventName,
        provider: event.provider,
        workspaceId,
        processingError,
      });
      await this.webhookAlertService.notifyWebhookFailure({
        eventId: stored.id,
        eventName: event.eventName,
        provider: event.provider,
        workspaceId,
        processingError,
      });
      return { received: true, failed: true, processingError };
    }

    try {
      const preSyncHadPaymentFailureByWorkspace =
        await this.loadPreSyncPaymentFailureFlags(actions);

      for (const action of actions) {
        await this.webhookProcessingService.applyAction(action);
      }

      const allIgnored = actions.every((a: BillingWebhookAction) => a.kind === 'ignored');
      const finalStatus = allIgnored ? 'ignored' : 'processed';
      await this.webhookEventsService.markProcessed(
        stored.id,
        finalStatus,
        allIgnored ? actions.map((a) => (a.kind === 'ignored' ? a.reason : '')).join('; ') : null,
      );

      logBillingWebhookProcessed(this.logger, {
        eventId: stored.id,
        eventName: event.eventName,
        provider: event.provider,
        workspaceId,
        status: finalStatus,
      });

      if (!allIgnored) {
        await this.paymentNotificationService.handleWebhookProcessed({
          webhookEventId: stored.id,
          eventName: event.eventName,
          actions,
          preSyncHadPaymentFailureByWorkspace,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.webhookEventsService.markFailed(stored.id, message);
      logBillingWebhookFailed(this.logger, {
        eventId: stored.id,
        eventName: event.eventName,
        provider: event.provider,
        workspaceId,
        processingError: message,
      });
      await this.webhookAlertService.notifyWebhookFailure({
        eventId: stored.id,
        eventName: event.eventName,
        provider: event.provider,
        workspaceId,
        processingError: message,
      });
      throw err;
    }

    return { received: true, duplicate: false, eventName: event.eventName };
  }

  private async loadPreSyncPaymentFailureFlags(
    actions: BillingWebhookAction[],
  ): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    const workspaceIds = [
      ...new Set(
        actions
          .filter((a): a is Extract<BillingWebhookAction, { kind: 'subscription_sync' }> => a.kind === 'subscription_sync')
          .map((a) => a.workspaceId)
          .filter((id) => Types.ObjectId.isValid(id)),
      ),
    ];

    if (workspaceIds.length === 0) return result;

    const objectIds = workspaceIds.map((id) => new Types.ObjectId(id));
    const rows = await this.subscriptionModel
      .find({ workspaceId: { $in: objectIds } })
      .select('workspaceId status paymentFailure')
      .lean()
      .exec();

    for (const id of workspaceIds) {
      const row = rows.find((r) => String(r.workspaceId) === id);
      result[id] =
        row?.status === 'past_due' ||
        Boolean(row?.paymentFailure?.failedAt) ||
        Boolean(row?.paymentFailure?.notifiedWebhookEventId);
    }

    return result;
  }

  private isMissingWorkspaceFailure(actions: BillingWebhookAction[]): boolean {
    return (
      actions.length > 0 &&
      actions.every((action) => action.kind === 'ignored' && action.reason === 'missing_workspace_id')
    );
  }
}
