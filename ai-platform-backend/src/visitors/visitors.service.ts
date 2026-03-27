import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bot, Conversation, Message, Visitor, VisitorEvent } from '../models';
import type { VisitorEventType, VisitorKind } from '../models';

/** Matches platform visitors, including legacy docs without `visitorType`. */
function platformVisitorFilter(visitorId: string): Record<string, unknown> {
  return {
    visitorId,
    $or: [{ visitorType: 'platform' as VisitorKind }, { visitorType: { $exists: false } }],
  };
}

export type BotType = 'showcase' | 'visitor-own';

export interface VisitorProfileUpdate {
  name?: string;
  email?: string;
  phone?: string;
}

export interface UsageLimits {
  showcaseMessageLimit: number;
  ownBotMessageLimit: number;
}

export interface UsageCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
}

export interface TrialBotUsageCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
}

@Injectable()
export class VisitorsService {
  constructor(
    @InjectModel(Visitor.name) private readonly visitorModel: Model<Visitor>,
    @InjectModel(VisitorEvent.name) private readonly visitorEventModel: Model<VisitorEvent>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
  ) { }

  async findAll() {
    const rows = await this.visitorModel.find().lean();
    return (rows as Record<string, unknown>[]).map((v) => ({
      ...v,
      visitorType: (v.visitorType as VisitorKind | undefined) ?? 'platform',
      platformVisitorId: String(v.visitorId ?? ''),
      /** @deprecated legacy alias */
      visitorId: v.visitorId,
    }));
  }

  /**
   * Platform visitor identity (used for analytics / trial bot quota).
   *
   * Note: the Mongo field is still named `visitorId` (legacy/compat). The
   * parameter and DTOs use `platformVisitorId` explicitly.
   */
  async getOrCreateVisitor(platformVisitorId: string) {
    if (!platformVisitorId) {
      throw new Error('platformVisitorId is required.');
    }

    const now = new Date();

    const existingVisitor = await this.visitorModel.findOneAndUpdate(
      platformVisitorFilter(platformVisitorId),
      { $set: { lastSeenAt: now, visitorType: 'platform' } },
      { new: true },
    );

    if (existingVisitor) {
      return existingVisitor;
    }

    const createdVisitor = await this.visitorModel.create({
      visitorId: platformVisitorId,
      visitorType: 'platform',
      showcaseMessageCount: 0,
      ownBotMessageCount: 0,
      createdAt: now,
      lastSeenAt: now,
    });

    return createdVisitor;
  }

  /**
   * Persist embed chat identity (`chatVisitorId`) in `visitors` alongside platform rows.
   * Conversation/Message still key by `chatVisitorId` only; this is for admin/analytics parity.
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

  async updateVisitorProfile(
    platformVisitorId: string,
    data: VisitorProfileUpdate,
  ) {
    if (!platformVisitorId) {
      throw new Error('platformVisitorId is required.');
    }

    const now = new Date();
    const updateFields: Partial<VisitorProfileUpdate> & { lastSeenAt: Date } = {
      lastSeenAt: now,
    };

    if (data.name !== undefined) {
      updateFields.name = data.name;
    }
    if (data.email !== undefined) {
      updateFields.email = data.email;
    }
    if (data.phone !== undefined) {
      updateFields.phone = data.phone;
    }

    const updatedVisitor = await this.visitorModel.findOneAndUpdate(
      platformVisitorFilter(platformVisitorId),
      { $set: { ...updateFields, visitorType: 'platform' } },
      { new: true, upsert: false },
    );

    return updatedVisitor ?? null;
  }

  async createVisitorEvent(params: {
    platformVisitorId?: string;
    /** @deprecated legacy alias for platformVisitorId */
    visitorId?: string;
    type: VisitorEventType;
    path?: string;
    botSlug?: string;
    botId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const platformVisitorId = String((params.platformVisitorId ?? params.visitorId) || '').trim();
    if (!platformVisitorId) return null;
    const payload: Record<string, unknown> = {
      // Mongo legacy field name: `visitorId`
      visitorId: platformVisitorId,
      type: params.type,
      createdAt: new Date(),
    };
    if (params.path) payload.path = params.path;
    if (params.botSlug) payload.botSlug = params.botSlug;
    if (params.metadata && typeof params.metadata === 'object') {
      payload.metadata = params.metadata;
    }
    if (params.botId) payload.botId = params.botId;
    return this.visitorEventModel.create(payload);
  }

  async getAcceptedUserMessageCountForBotVisitor(
    botId: string,
    platformVisitorId: string,
  ): Promise<number> {
    if (!botId || !platformVisitorId) return 0;
    return this.messageModel.countDocuments({
      botId,
      // Mongo legacy field name: `visitorId`
      visitorId: platformVisitorId,
      role: 'user',
    });
  }

  async checkVisitorTrialBotUsage(params: {
    botId: string;
    platformVisitorId: string;
    limitTotal: number;
  }): Promise<TrialBotUsageCheckResult> {
    const safeLimit = Math.max(0, Math.floor(params.limitTotal));
    const current = await this.getAcceptedUserMessageCountForBotVisitor(params.botId, params.platformVisitorId);
    if (current >= safeLimit) return { allowed: false, current, limit: safeLimit };
    return { allowed: true, current, limit: safeLimit };
  }

  async checkAndIncrementUsage(
    platformVisitorId: string,
    botType: BotType,
    limits: UsageLimits,
  ): Promise<UsageCheckResult> {
    // TODO(step-2 enforcement): before incrementing counters, evaluate bot-level policy
    // using creatorType/messageLimitMode/messageLimitTotal plus visitor identity context.
    if (!platformVisitorId) {
      throw new Error('platformVisitorId is required.');
    }

    const visitor = await this.visitorModel.findOne(platformVisitorFilter(platformVisitorId));

    if (!visitor) {
      throw new Error('Platform visitor not found. Call getOrCreateVisitor first.');
    }

    const field =
      botType === 'showcase' ? 'showcaseMessageCount' : 'ownBotMessageCount';
    const limit =
      botType === 'showcase'
        ? limits.showcaseMessageLimit
        : limits.ownBotMessageLimit;

    const current = (visitor as unknown as Record<string, number>)[field];

    if (current >= limit) {
      return { allowed: false, current, limit };
    }

    const now = new Date();

    await this.visitorModel.updateOne(
      { _id: visitor._id },
      { $inc: { [field]: 1 }, $set: { lastSeenAt: now } },
    );

    return { allowed: true, current: current + 1, limit };
  }

  /** Get one visitor with events, owned bots, and conversation count (for user panel detail page). */
  async getOneWithDetails(platformVisitorId: string) {
    const visitor = await this.visitorModel.findOne(platformVisitorFilter(platformVisitorId)).lean();
    if (!visitor) return null;
    const [events, bots, conversationsCount] = await Promise.all([
      this.visitorEventModel
        .find({ visitorId: platformVisitorId })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('createdAt type path botSlug')
        .lean(),
      this.botModel
        .find({ ownerVisitorId: platformVisitorId })
        .sort({ createdAt: -1 })
        .select('_id name slug createdAt')
        .lean(),
      this.conversationModel.countDocuments({ visitorId: platformVisitorId }),
    ]);
    const v = visitor as Record<string, unknown>;
    return {
      visitor: {
        ...v,
        visitorType: (v.visitorType as VisitorKind | undefined) ?? 'platform',
        platformVisitorId: String(v.visitorId ?? ''),
        /** @deprecated legacy alias */
        visitorId: v.visitorId,
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
      bots: (bots as Record<string, unknown>[]).map((b) => ({
        _id: String(b._id),
        name: b.name,
        slug: b.slug,
        createdAt: (b.createdAt as Date)?.toISOString?.() ?? null,
      })),
      conversationsCount,
    };
  }
}
