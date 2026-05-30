import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BillingWebhookEventRecord } from '../models/billing-webhook-event.schema';
import type { BillingWebhookEventStatus } from '../models/billing-webhook-event.schema';
import { BillingProviderService } from './billing-provider.service';
import { BillingWebhookEventsService } from './billing-webhook-events.service';
import { BillingWebhookProcessingService } from './billing-webhook-processing.service';
import {
  logBillingWebhookReplayCompleted,
  logBillingWebhookReplayStarted,
} from './billing-webhook-log.util';
import type { BillingWebhookAction, BillingWebhookEvent } from './billing-provider.types';

const REPLAYABLE_STATUSES = new Set<BillingWebhookEventStatus>(['received', 'failed']);

export type BillingWebhookReplayResult = {
  replayed: boolean;
  status: BillingWebhookEventStatus | 'failed';
  message: string;
};

@Injectable()
export class BillingAdminWebhookReplayService {
  private readonly logger = new Logger(BillingAdminWebhookReplayService.name);

  constructor(
    @InjectModel(BillingWebhookEventRecord.name)
    private readonly webhookEventModel: Model<BillingWebhookEventRecord>,
    private readonly billingProviderService: BillingProviderService,
    private readonly webhookEventsService: BillingWebhookEventsService,
    private readonly webhookProcessingService: BillingWebhookProcessingService,
  ) {}

  async replayEvent(eventId: string): Promise<BillingWebhookReplayResult> {
    const doc = await this.webhookEventModel.findById(eventId).lean().exec();
    if (!doc) {
      throw new NotFoundException({ error: 'Webhook event not found.' });
    }

    if (!REPLAYABLE_STATUSES.has(doc.status)) {
      throw new BadRequestException({
        error: 'Only received or failed webhook events can be replayed.',
        status: doc.status,
      });
    }

    const workspaceId = doc.workspaceId ? String(doc.workspaceId) : null;
    logBillingWebhookReplayStarted(this.logger, {
      eventId: String(doc._id),
      eventName: doc.eventName,
      provider: doc.provider,
      workspaceId,
    });

    await this.webhookEventsService.markWebhookRetryScheduled(String(doc._id));

    const event = this.eventFromStored(doc);
    const mapped = await this.billingProviderService.mapWebhookEvent(event);
    const actions = Array.isArray(mapped) ? mapped : [mapped];

    try {
      for (const action of actions) {
        await this.webhookProcessingService.applyAction(action);
      }
      const allIgnored = actions.every((a: BillingWebhookAction) => a.kind === 'ignored');
      const finalStatus = allIgnored ? 'ignored' : 'processed';
      const processingNote = allIgnored
        ? actions
            .map((a) => (a.kind === 'ignored' ? a.reason : ''))
            .filter(Boolean)
            .join('; ') || 'ignored'
        : null;

      await this.webhookEventsService.markWebhookReplaySuccess(
        String(doc._id),
        finalStatus,
        processingNote,
      );

      const result: BillingWebhookReplayResult = {
        replayed: true,
        status: finalStatus,
        message: 'Webhook event replayed successfully.',
      };

      logBillingWebhookReplayCompleted(this.logger, {
        eventId: String(doc._id),
        eventName: doc.eventName,
        provider: doc.provider,
        workspaceId,
        status: finalStatus,
        replayed: true,
      });

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.webhookEventsService.markWebhookReplayFailed(String(doc._id), message);

      logBillingWebhookReplayCompleted(this.logger, {
        eventId: String(doc._id),
        eventName: doc.eventName,
        provider: doc.provider,
        workspaceId,
        status: 'failed',
        replayed: false,
      });

      return {
        replayed: false,
        status: 'failed',
        message,
      };
    }
  }

  private eventFromStored(doc: {
    provider: BillingWebhookEvent['provider'];
    providerEventId: string;
    eventName: string;
    rawPayload: Record<string, unknown>;
  }): BillingWebhookEvent {
    const customData: Record<string, string> = {};
    const rawCustom =
      doc.rawPayload &&
      typeof doc.rawPayload === 'object' &&
      doc.rawPayload.meta &&
      typeof doc.rawPayload.meta === 'object' &&
      (doc.rawPayload.meta as { custom_data?: Record<string, unknown> }).custom_data;

    if (rawCustom && typeof rawCustom === 'object') {
      for (const [k, v] of Object.entries(rawCustom)) {
        customData[k] = String(v ?? '').trim();
      }
    }

    return {
      provider: doc.provider,
      providerEventId: doc.providerEventId,
      eventName: doc.eventName,
      customData,
      payload: doc.rawPayload,
    };
  }
}
