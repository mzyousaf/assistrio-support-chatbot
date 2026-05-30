import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BillingWebhookEventRecord } from '../models/billing-webhook-event.schema';
import type { BillingWebhookEventStatus } from '../models/billing-webhook-event.schema';
import { extractWorkspaceIdFromWebhookPayload } from './billing-webhook-payload.util';
import type { BillingProvider, BillingWebhookEvent } from './billing-provider.types';

export type StoredBillingWebhookEvent = {
  id: string;
  isDuplicate: boolean;
  status: BillingWebhookEventStatus;
};

export type BillingWebhookEventSummary = {
  id: string;
  provider: BillingProvider;
  providerEventId: string;
  eventName: string;
  status: BillingWebhookEventStatus;
  workspaceId: string | null;
  processingError: string | null;
  receivedAt: Date | null;
  processedAt: Date | null;
  failedAt: Date | null;
  retryCount: number;
  createdAt: Date | null;
};

@Injectable()
export class BillingWebhookEventsService {
  constructor(
    @InjectModel(BillingWebhookEventRecord.name)
    private readonly webhookEventModel: Model<BillingWebhookEventRecord>,
  ) {}

  private hashPayload(rawBody: Buffer): string {
    return createHash('sha256').update(rawBody).digest('hex');
  }

  private resolveWorkspaceObjectId(rawPayload: Record<string, unknown>): Types.ObjectId | null {
    const workspaceId = extractWorkspaceIdFromWebhookPayload(rawPayload);
    if (!workspaceId || !Types.ObjectId.isValid(workspaceId)) return null;
    return new Types.ObjectId(workspaceId);
  }

  /**
   * Stores webhook event before processing. Returns duplicate=true when already stored.
   */
  async storeReceivedEvent(
    rawBody: Buffer,
    event: BillingWebhookEvent,
  ): Promise<StoredBillingWebhookEvent> {
    const payloadHash = this.hashPayload(rawBody);
    const rawPayload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    const receivedAt = new Date();
    const workspaceId = this.resolveWorkspaceObjectId(rawPayload);

    try {
      const created = await this.webhookEventModel.create({
        provider: event.provider satisfies BillingProvider,
        providerEventId: event.providerEventId,
        eventName: event.eventName,
        payloadHash,
        rawPayload,
        status: 'received',
        processingError: null,
        receivedAt,
        processedAt: null,
        failedAt: null,
        retryCount: 0,
        lastRetryAt: null,
        nextRetryAt: null,
        workspaceId,
        alertedAt: null,
      });
      return {
        id: String(created._id),
        isDuplicate: false,
        status: 'received',
      };
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? Number((err as { code: unknown }).code) : NaN;
      if (code === 11000) {
        const existing = await this.webhookEventModel
          .findOne({ provider: event.provider, providerEventId: event.providerEventId })
          .lean();
        return {
          id: String(existing?._id ?? ''),
          isDuplicate: true,
          status: existing?.status ?? 'received',
        };
      }
      throw err;
    }
  }

  async markProcessed(id: string, status: 'processed' | 'ignored', error?: string | null): Promise<void> {
    if (!id) return;
    await this.webhookEventModel.updateOne(
      { _id: id },
      {
        $set: {
          status,
          processingError: error ?? null,
          processedAt: new Date(),
          failedAt: null,
        },
      },
    );
  }

  async markFailed(id: string, error: string): Promise<void> {
    if (!id) return;
    await this.webhookEventModel.updateOne(
      { _id: id },
      {
        $set: {
          status: 'failed',
          processingError: error,
          failedAt: new Date(),
        },
      },
    );
  }

  async getFailedWebhookCount(): Promise<number> {
    return this.webhookEventModel.countDocuments({ status: 'failed' }).exec();
  }

  async getRecentFailedWebhooks(limit = 20): Promise<BillingWebhookEventSummary[]> {
    const rows = await this.webhookEventModel
      .find({ status: 'failed' })
      .sort({ failedAt: -1, createdAt: -1 })
      .limit(limit)
      .select(
        'provider providerEventId eventName status workspaceId processingError receivedAt processedAt failedAt retryCount createdAt',
      )
      .lean()
      .exec();

    return rows.map((row) => this.toSummary(row));
  }

  async markWebhookRetryScheduled(id: string, nextRetryAt?: Date | null): Promise<void> {
    if (!id) return;
    const now = new Date();
    await this.webhookEventModel.updateOne(
      { _id: id },
      {
        $inc: { retryCount: 1 },
        $set: {
          lastRetryAt: now,
          nextRetryAt: nextRetryAt ?? null,
        },
      },
    );
  }

  async markWebhookReplaySuccess(id: string, status: 'processed' | 'ignored', error?: string | null): Promise<void> {
    if (!id) return;
    const now = new Date();
    await this.webhookEventModel.updateOne(
      { _id: id },
      {
        $set: {
          status,
          processingError: error ?? null,
          processedAt: now,
          failedAt: null,
          lastRetryAt: now,
          nextRetryAt: null,
        },
      },
    );
  }

  async markWebhookReplayFailed(id: string, error: string): Promise<void> {
    if (!id) return;
    const now = new Date();
    await this.webhookEventModel.updateOne(
      { _id: id },
      {
        $inc: { retryCount: 1 },
        $set: {
          status: 'failed',
          processingError: error,
          failedAt: now,
          lastRetryAt: now,
          nextRetryAt: null,
        },
      },
    );
  }

  async markAlertSent(id: string): Promise<void> {
    if (!id) return;
    await this.webhookEventModel.updateOne({ _id: id }, { $set: { alertedAt: new Date() } });
  }

  async findById(id: string) {
    if (!id) return null;
    return this.webhookEventModel.findById(id).lean().exec();
  }

  /** Recent webhook events whose custom_data references this workspace (admin support). */
  async findRecentForWorkspace(workspaceId: string, limit = 20) {
    const id = String(workspaceId ?? '').trim();
    if (!id) return [];

    return this.webhookEventModel
      .find({
        $or: [
          { workspaceId: Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id },
          { 'rawPayload.meta.custom_data.workspaceId': id },
          { 'rawPayload.meta.custom_data.workspace_id': id },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        'eventName status processingError processedAt failedAt receivedAt retryCount createdAt',
      )
      .lean()
      .exec();
  }

  private toSummary(row: {
    _id?: Types.ObjectId;
    provider: BillingProvider;
    providerEventId: string;
    eventName: string;
    status: BillingWebhookEventStatus;
    workspaceId?: Types.ObjectId | null;
    processingError?: string | null;
    receivedAt?: Date | null;
    processedAt?: Date | null;
    failedAt?: Date | null;
    retryCount?: number;
    createdAt?: Date;
  }): BillingWebhookEventSummary {
    return {
      id: String(row._id ?? ''),
      provider: row.provider,
      providerEventId: row.providerEventId,
      eventName: row.eventName,
      status: row.status,
      workspaceId: row.workspaceId ? String(row.workspaceId) : null,
      processingError: row.processingError?.trim() || null,
      receivedAt: row.receivedAt ?? null,
      processedAt: row.processedAt ?? null,
      failedAt: row.failedAt ?? null,
      retryCount: row.retryCount ?? 0,
      createdAt: row.createdAt ?? null,
    };
  }
}
