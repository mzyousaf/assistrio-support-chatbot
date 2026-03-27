import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot, Visitor, VisitorEvent, type VisitorEventType } from '../models';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(VisitorEvent.name) private readonly visitorEventModel: Model<VisitorEvent>,
    @InjectModel(Visitor.name) private readonly visitorModel: Model<Visitor>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
  ) {}

  async logVisitorEvent(params: {
    platformVisitorId: string;
    type: VisitorEventType;
    path?: string;
    botSlug?: string;
    botId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      if (!params.platformVisitorId) {
        return;
      }

      const eventDoc: {
        visitorId: string;
        type: VisitorEventType;
        path?: string;
        botSlug?: string;
        botId?: Types.ObjectId;
        metadata?: Record<string, unknown>;
        createdAt: Date;
      } = {
        visitorId: params.platformVisitorId,
        type: params.type,
        path: params.path,
        botSlug: params.botSlug,
        metadata: params.metadata,
        createdAt: new Date(),
      };

      if (params.botId && Types.ObjectId.isValid(params.botId)) {
        eventDoc.botId = new Types.ObjectId(params.botId);
      }

      await this.visitorEventModel.create(eventDoc);
    } catch (error) {
      console.error('Failed to log visitor event', error);
    }
  }

  async getSummary() {
    const platformVisitorFilter: Record<string, unknown> = {
      $or: [{ visitorType: 'platform' }, { visitorType: { $exists: false } }],
    };

    const [
      totalVisitors,
      totalChatVisitors,
      totalPageViews,
      trialBotsCreated,
      demoChatsStarted,
      trialChatsStarted,
      showcaseBots,
      visitorOwnedBots,
    ] = await Promise.all([
      this.visitorModel.countDocuments(platformVisitorFilter),
      this.visitorModel.countDocuments({ visitorType: 'chat' }),
      this.visitorEventModel.countDocuments({ type: 'page_view' }),
      this.visitorEventModel.countDocuments({ type: 'trial_bot_created' }),
      this.visitorEventModel.countDocuments({ type: 'demo_chat_started' }),
      this.visitorEventModel.countDocuments({ type: 'trial_chat_started' }),
      this.botModel.countDocuments({ type: 'showcase' }),
      this.botModel.countDocuments({ type: 'visitor-own' }),
    ]);
    const recentEvents = await this.visitorEventModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .select('visitorId type path botSlug createdAt')
      .lean();
    const metrics = [
      { label: 'Total Visitors', value: totalVisitors },
      { label: 'Chat widget identities', value: totalChatVisitors },
      { label: 'Total Page Views', value: totalPageViews },
      { label: 'Trial Bots Created', value: trialBotsCreated },
      { label: 'Demo Chats Started', value: demoChatsStarted },
      { label: 'Trial Chats Started', value: trialChatsStarted },
      { label: 'Showcase Bots', value: showcaseBots },
      { label: 'Visitor-Owned Bots', value: visitorOwnedBots },
    ];
    return {
      metrics,
      recentEvents: (recentEvents as Record<string, unknown>[]).map((e) => ({
        _id: String(e._id),
        platformVisitorId: e.visitorId ?? null,
        /** @deprecated legacy alias */
        visitorId: e.visitorId ?? null,
        type: e.type,
        path: e.path,
        botSlug: e.botSlug,
        createdAt: (e.createdAt as Date)?.toISOString?.() ?? null,
      })),
    };
  }

  /** Create visitor event for /api/analytics/track (throws on error). */
  async trackEvent(params: {
    platformVisitorId: string;
    type: VisitorEventType;
    path?: string;
    botSlug?: string;
    botId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const eventDoc: {
      visitorId: string;
      type: typeof params.type;
      path?: string;
      botSlug?: string;
      botId?: Types.ObjectId;
      metadata?: Record<string, unknown>;
      createdAt: Date;
    } = {
      visitorId: params.platformVisitorId,
      type: params.type,
      path: params.path,
      botSlug: params.botSlug,
      metadata: params.metadata,
      createdAt: new Date(),
    };
    if (params.botId && Types.ObjectId.isValid(params.botId)) {
      eventDoc.botId = new Types.ObjectId(params.botId);
    }
    await this.visitorEventModel.create(eventDoc);
  }
}
