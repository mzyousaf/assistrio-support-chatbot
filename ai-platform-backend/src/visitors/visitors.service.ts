import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Visitor, VisitorEvent } from '../models';
import type { VisitorKind } from '../models';

/**
 * Owner preview chat (`/api/widget/preview/chat`) — per authenticated workspace user, not anonymous identity.
 * `0` disables the cap (IP / rate limits still apply).
 */
export const OWNER_PREVIEW_USER_MESSAGE_CAP = 50;

/** @deprecated Use OWNER_PREVIEW_USER_MESSAGE_CAP */
export const PLATFORM_VISITOR_PREVIEW_USER_MESSAGE_CAP = OWNER_PREVIEW_USER_MESSAGE_CAP;

function marketingVisitorFilter(visitorId: string): Record<string, unknown> {
  return {
    visitorId,
    $or: [{ visitorType: 'marketing' as VisitorKind }, { visitorType: 'platform' as VisitorKind }, { visitorType: { $exists: false } }],
  };
}

function ownerPreviewFilter(userId: string): Record<string, unknown> {
  return { visitorId: userId, visitorType: 'owner_preview' as VisitorKind };
}

@Injectable()
export class VisitorsService {
  constructor(
    @InjectModel(Visitor.name) private readonly visitorModel: Model<Visitor>,
    @InjectModel(VisitorEvent.name) private readonly visitorEventModel: Model<VisitorEvent>,
  ) {}

  /**
   * Marketing / funnel analytics identity — upsert only; does not grant product access.
   */
  async touchMarketingVisitor(visitorId: string) {
    const id = String(visitorId ?? '').trim();
    if (!id) {
      throw new Error('visitorId is required.');
    }
    const now = new Date();
    const updated = await this.visitorModel.findOneAndUpdate(
      marketingVisitorFilter(id),
      {
        $set: {
          lastSeenAt: now,
          visitorType: 'marketing',
        },
      },
      { new: true },
    );
    if (updated) return updated;
    return this.visitorModel.create({
      visitorId: id,
      visitorType: 'marketing',
      showcaseMessageCount: 0,
      ownBotMessageCount: 0,
      trialPreviewUserMessageCount: 0,
      previewUserMessageCount: 0,
      createdAt: now,
      lastSeenAt: now,
    });
  }

  /**
   * Persist embed chat identity for admin lists (optional mirror row).
   */
  async getOrCreateChatVisitor(chatVisitorId: string) {
    if (!chatVisitorId?.trim()) {
      throw new Error('chatVisitorId is required.');
    }
    const id = chatVisitorId.trim();
    const now = new Date();

    const existing = await this.visitorModel.findOneAndUpdate(
      { visitorId: id, visitorType: 'chat' },
      { $set: { lastSeenAt: now } },
      { new: true },
    );

    if (existing) {
      return existing;
    }

    return this.visitorModel.create({
      visitorId: id,
      visitorType: 'chat',
      showcaseMessageCount: 0,
      ownBotMessageCount: 0,
      createdAt: now,
      lastSeenAt: now,
    });
  }

  async ensureOwnerPreviewVisitor(userId: string): Promise<void> {
    const id = String(userId ?? '').trim();
    if (!id || !Types.ObjectId.isValid(id)) return;
    const now = new Date();
    const existingOwner = await this.visitorModel.findOne(ownerPreviewFilter(id)).lean();
    if (existingOwner) {
      await this.visitorModel.updateOne(ownerPreviewFilter(id), { $set: { lastSeenAt: now } });
      return;
    }
    let seedPreview = 0;
    if (Types.ObjectId.isValid(id)) {
      const legacy = await this.visitorModel.findOne({ visitorId: id, visitorType: 'platform' }).lean();
      if (legacy) {
        const row = legacy as { previewUserMessageCount?: unknown; trialPreviewUserMessageCount?: unknown };
        seedPreview = Math.max(
          Math.floor(Number(row.previewUserMessageCount ?? 0)),
          Math.floor(Number(row.trialPreviewUserMessageCount ?? 0)),
        );
      }
    }
    await this.visitorModel.updateOne(
      ownerPreviewFilter(id),
      {
        $setOnInsert: {
          visitorId: id,
          visitorType: 'owner_preview',
          showcaseMessageCount: 0,
          ownBotMessageCount: 0,
          previewUserMessageCount: seedPreview,
          createdAt: now,
        },
        $set: { lastSeenAt: now },
      },
      { upsert: true },
    );
  }

  async checkOwnerPreviewMessageQuota(userId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
  }> {
    const limit = OWNER_PREVIEW_USER_MESSAGE_CAP;
    if (limit <= 0) {
      return { allowed: true, current: 0, limit: 0 };
    }
    const id = String(userId ?? '').trim();
    if (!id) return { allowed: true, current: 0, limit };

    let v = await this.visitorModel.findOne(ownerPreviewFilter(id)).lean();
    if (!v && Types.ObjectId.isValid(id)) {
      v = await this.visitorModel.findOne({ visitorId: id, visitorType: 'platform' }).lean();
    }
    const row = v as Record<string, unknown> | null | undefined;
    const a = Math.floor(Number(row?.previewUserMessageCount ?? 0));
    const b = Math.floor(Number(row?.trialPreviewUserMessageCount ?? 0));
    const current = Math.max(0, a + b);
    return { allowed: current < limit, current, limit };
  }

  async incrementOwnerPreviewMessageCount(userId: string): Promise<void> {
    const id = String(userId ?? '').trim();
    if (!id) return;
    await this.visitorModel.updateOne(ownerPreviewFilter(id), { $inc: { previewUserMessageCount: 1 } });
  }

  /** Admin: recent marketing/analytics visitor rows (no chat mirrors, no owner preview counters). */
  async findAll() {
    const rows = await this.visitorModel
      .find({
        $or: [{ visitorType: 'marketing' }, { visitorType: 'platform' }, { visitorType: { $exists: false } }],
      })
      .lean();
    return (rows as Record<string, unknown>[]).map((v) => ({
      ...v,
      visitorType: normalizeVisitorTypeLabel(v.visitorType),
      visitorId: String(v.visitorId ?? ''),
    }));
  }

  /** Detail for a marketing analytics id — events only; bots are always owner-scoped elsewhere. */
  async getOneWithDetails(visitorId: string) {
    const id = String(visitorId ?? '').trim();
    const visitor = await this.visitorModel.findOne(marketingVisitorFilter(id)).lean();
    if (!visitor) return null;
    const [events] = await Promise.all([
      this.visitorEventModel
        .find({ visitorId: id })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('createdAt type path botSlug')
        .lean(),
    ]);
    const v = visitor as Record<string, unknown>;
    return {
      visitor: {
        ...v,
        visitorType: normalizeVisitorTypeLabel(v.visitorType),
        visitorId: String(v.visitorId ?? ''),
        _id: String(v._id),
        createdAt: (v.createdAt as Date)?.toISOString?.() ?? null,
        lastSeenAt: (v.lastSeenAt as Date)?.toISOString?.() ?? null,
      },
      events: (events as Record<string, unknown>[]).map((e) => ({
        _id: String(e._id),
        createdAt: (e.createdAt as Date)?.toISOString?.() ?? null,
        type: e.type,
        path: e.path,
        botSlug: e.botSlug,
      })),
      bots: [] as Array<{ _id: string; name?: string; slug?: string; createdAt?: string | null }>,
      conversationsCount: 0,
    };
  }
}

function normalizeVisitorTypeLabel(t: unknown): VisitorKind | 'marketing' {
  if (t === 'platform' || t === undefined) return 'marketing';
  if (t === 'marketing' || t === 'chat' || t === 'owner_preview') return t;
  return 'marketing';
}
