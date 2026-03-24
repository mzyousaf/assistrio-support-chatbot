import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bot, Conversation, Visitor, VisitorEvent } from '../models';

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

@Injectable()
export class VisitorsService {
  constructor(
    @InjectModel(Visitor.name) private readonly visitorModel: Model<Visitor>,
    @InjectModel(VisitorEvent.name) private readonly visitorEventModel: Model<VisitorEvent>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
  ) { }

  async findAll() {
    return this.visitorModel.find().lean();
  }

  async getOrCreateVisitor(visitorId: string) {
    if (!visitorId) {
      throw new Error('visitorId is required.');
    }

    const now = new Date();

    const existingVisitor = await this.visitorModel.findOneAndUpdate(
      { visitorId },
      { $set: { lastSeenAt: now } },
      { new: true },
    );

    if (existingVisitor) {
      return existingVisitor;
    }

    const createdVisitor = await this.visitorModel.create({
      visitorId,
      showcaseMessageCount: 0,
      ownBotMessageCount: 0,
      createdAt: now,
      lastSeenAt: now,
    });

    return createdVisitor;
  }

  async updateVisitorProfile(
    visitorId: string,
    data: VisitorProfileUpdate,
  ) {
    if (!visitorId) {
      throw new Error('visitorId is required.');
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
      { visitorId },
      { $set: updateFields },
      { new: true, upsert: false },
    );

    return updatedVisitor ?? null;
  }

  async checkAndIncrementUsage(
    visitorId: string,
    botType: BotType,
    limits: UsageLimits,
  ): Promise<UsageCheckResult> {
    if (!visitorId) {
      throw new Error('visitorId is required.');
    }

    const visitor = await this.visitorModel.findOne({ visitorId });

    if (!visitor) {
      throw new Error('Visitor not found. Call getOrCreateVisitor first.');
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
  async getOneWithDetails(visitorId: string) {
    const visitor = await this.visitorModel.findOne({ visitorId }).lean();
    if (!visitor) return null;
    const [events, bots, conversationsCount] = await Promise.all([
      this.visitorEventModel
        .find({ visitorId })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('createdAt type path botSlug')
        .lean(),
      this.botModel
        .find({ ownerVisitorId: visitorId })
        .sort({ createdAt: -1 })
        .select('_id name slug createdAt')
        .lean(),
      this.conversationModel.countDocuments({ visitorId }),
    ]);
    const v = visitor as Record<string, unknown>;
    return {
      visitor: {
        ...v,
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
