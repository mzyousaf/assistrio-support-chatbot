import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Visitor, VisitorEvent } from '../models';
import type { VisitorKind } from '../models';

function marketingVisitorFilter(visitorId: string): Record<string, unknown> {
  return {
    visitorId,
    $or: [{ visitorType: 'marketing' as VisitorKind }, { visitorType: 'platform' as VisitorKind }, { visitorType: { $exists: false } }],
  };
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
