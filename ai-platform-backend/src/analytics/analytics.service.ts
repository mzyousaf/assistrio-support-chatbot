import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Bot,
  Conversation,
  Message,
  Visitor,
  VisitorEvent,
  type VisitorEventType,
} from '../models';
import type { OverviewDateRangeQuery } from './analytics-date-range.util';
import { parseOverviewDateRange } from './analytics-date-range.util';

/** Max bots returned from {@link getBotsSummary} (table + merge); remainder truncated with `truncated: true`. */
const MAX_BOTS_SUMMARY_ROWS = 400;

/** Max rows in {@link getLeadsSummary} `byBot` breakdown. */
const MAX_LEADS_BY_BOT_ROWS = 40;

/**
 * Internal analytics persistence and **authenticated** `/api/user/analytics` handlers.
 * PV-facing product summaries live under `/api/public/visitor-*` — not here.
 * `trackEvent` serves **ingestion** (`POST /api/analytics/track`) — not PV read APIs.
 *
 * @see docs/ANALYTICS_BOUNDARIES.md
 * @see docs/PV_SAFE_PUBLIC_APIS.md
 * @see docs/INTERNAL_ANALYTICS.md
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(VisitorEvent.name) private readonly visitorEventModel: Model<VisitorEvent>,
    @InjectModel(Visitor.name) private readonly visitorModel: Model<Visitor>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
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

  /**
   * Time-bounded internal dashboard overview — aggregates {@link VisitorEvent}, {@link Message},
   * {@link Conversation}, and {@link Bot}. Not a raw event export.
   */
  async getAnalyticsOverview(query: OverviewDateRangeQuery) {
    const { from, to, label } = parseOverviewDateRange(query);
    const evRange = { createdAt: { $gte: from, $lte: to } };

    const [
      totalVisitorEvents,
      trialBotsCreated,
      pageViews,
      ctaClicks,
      demoOpened,
      trialCreateStarted,
      trialCreateSucceeded,
      showcaseRuntimeUserMessages,
      trialRuntimeUserMessages,
      totalMessages,
      totalConversations,
      visitorOwnedBotsCreated,
      showcaseBotsActive,
      conversationsWithCapturedLeads,
    ] = await Promise.all([
      this.visitorEventModel.countDocuments(evRange),
      this.visitorEventModel.countDocuments({ ...evRange, type: 'trial_bot_created' }),
      this.visitorEventModel.countDocuments({ ...evRange, type: 'page_view' }),
      this.visitorEventModel.countDocuments({ ...evRange, type: 'cta_clicked' }),
      this.visitorEventModel.countDocuments({ ...evRange, type: 'demo_opened' }),
      this.visitorEventModel.countDocuments({ ...evRange, type: 'trial_create_started' }),
      this.visitorEventModel.countDocuments({ ...evRange, type: 'trial_create_succeeded' }),
      this.messageModel.countDocuments({
        ...evRange,
        role: 'user',
        showcaseRuntimeUserMessage: true,
      }),
      this.messageModel.countDocuments({
        ...evRange,
        role: 'user',
        trialRuntimeUserMessage: true,
      }),
      this.messageModel.countDocuments(evRange),
      this.conversationModel.countDocuments(evRange),
      this.botModel.countDocuments({
        type: 'visitor-own',
        createdAt: { $gte: from, $lte: to },
      }),
      this.botModel.countDocuments({ type: 'showcase', status: 'published' }),
      this.countConversationsWithCapturedLeadsInRange(from, to),
    ]);

    const caveats: string[] = [
      'Metrics are based on anonymous platformVisitorId / chatVisitorId data; they are not authenticated end-user counts.',
      'Landing and marketing funnel counts (page_view, cta_clicked, demo_opened, trial_create_*, etc.) depend on clients calling POST /api/analytics/track (and server-side trial_bot_created from trial creation).',
      'demo_chat_started and trial_chat_started event types are not emitted by this backend today; do not use them as KPIs until instrumented.',
      'showcaseBotsActive is a point-in-time count of bots with type=showcase and status=published (not scoped to the selected date range).',
      'conversationsWithCapturedLeads: conversations with lastActivityAt in range (or createdAt if lastActivityAt is missing) and at least one non-empty capturedLeadData value.',
    ];

    return {
      schemaVersion: 1 as const,
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        label,
      },
      overview: {
        totalVisitorEvents,
        trialBotsCreated,
        pageViews,
        ctaClicks,
        demoOpened,
        trialCreateStarted,
        trialCreateSucceeded,
      },
      messages: {
        showcaseRuntimeUserMessages,
        trialRuntimeUserMessages,
        totalMessages,
        totalConversations,
      },
      bots: {
        visitorOwnedBotsCreated,
        showcaseBotsActive,
      },
      leads: {
        conversationsWithCapturedLeads,
      },
      caveats,
    };
  }

  /**
   * Per-bot operational metrics for the internal dashboard table (`createdAt` window matches overview
   * message/conversation totals; per-bot lead rows use the same “touched in range” rule as overview leads).
   */
  async getBotsSummary(query: OverviewDateRangeQuery) {
    const { from, to, label } = parseOverviewDateRange(query);
    const evRange = { createdAt: { $gte: from, $lte: to } };

    const [messageStats, conversationStats, leadByBot] = await Promise.all([
      this.messageModel.aggregate<{
        _id: Types.ObjectId;
        messageCount: number;
        showcaseRuntimeUserMessages: number;
        trialRuntimeUserMessages: number;
      }>([
        { $match: evRange },
        {
          $group: {
            _id: '$botId',
            messageCount: { $sum: 1 },
            showcaseRuntimeUserMessages: {
              $sum: {
                $cond: [
                  {
                    $and: [{ $eq: ['$role', 'user'] }, { $eq: ['$showcaseRuntimeUserMessage', true] }],
                  },
                  1,
                  0,
                ],
              },
            },
            trialRuntimeUserMessages: {
              $sum: {
                $cond: [
                  {
                    $and: [{ $eq: ['$role', 'user'] }, { $eq: ['$trialRuntimeUserMessage', true] }],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      this.conversationModel.aggregate<{ _id: Types.ObjectId; conversationCount: number }>([
        { $match: evRange },
        { $group: { _id: '$botId', conversationCount: { $sum: 1 } } },
      ]),
      this.aggregateLeadsByBot(from, to),
    ]);

    const messageMap = new Map(
      messageStats.map((r) => [
        String(r._id),
        {
          messageCount: r.messageCount,
          showcaseRuntimeUserMessages: r.showcaseRuntimeUserMessages,
          trialRuntimeUserMessages: r.trialRuntimeUserMessages,
        },
      ]),
    );
    const conversationMap = new Map(conversationStats.map((r) => [String(r._id), r.conversationCount]));
    const leadMap = new Map(
      leadByBot.map((r) => [r.botId, { conversationsWithCapturedLeads: r.conversationsWithCapturedLeads }]),
    );

    const botDocs = await this.botModel
      .find({})
      .select(
        '-secretKey -openaiApiKeyOverride -whisperApiKeyOverride -personality.systemPrompt',
      )
      .lean();

    const rows = botDocs.map((b) => {
      const id = String(b._id);
      const m = messageMap.get(id);
      const messageCount = m?.messageCount ?? 0;
      const showcaseRuntimeUserMessages = m?.showcaseRuntimeUserMessages ?? 0;
      const trialRuntimeUserMessages = m?.trialRuntimeUserMessages ?? 0;
      const conversationCount = conversationMap.get(id) ?? 0;
      const conversationsWithCapturedLeads = leadMap.get(id)?.conversationsWithCapturedLeads ?? 0;
      const createdAt =
        b.createdAt instanceof Date ? b.createdAt.toISOString() : new Date(b.createdAt as Date).toISOString();
      return {
        botId: id,
        name: b.name,
        slug: b.slug,
        type: b.type,
        status: b.status ?? 'draft',
        visibility: (b.visibility ?? 'public') as string,
        isPublic: Boolean(b.isPublic),
        shortDescription: b.shortDescription ?? null,
        category: b.category ?? null,
        leadCaptureEnabled: b.leadCapture?.enabled === true,
        createdAt,
        messageCount,
        conversationCount,
        showcaseRuntimeUserMessages,
        trialRuntimeUserMessages,
        conversationsWithCapturedLeads,
      };
    });

    rows.sort((a, b) => {
      if (b.messageCount !== a.messageCount) return b.messageCount - a.messageCount;
      if (b.conversationCount !== a.conversationCount) return b.conversationCount - a.conversationCount;
      return a.name.localeCompare(b.name);
    });

    const truncated = rows.length > MAX_BOTS_SUMMARY_ROWS;
    const caveats: string[] = [
      'Conversation counts use conversation createdAt in the selected range (aligned with overview “total conversations”).',
      'conversationsWithCapturedLeads per bot uses the same touched-in-range rule as overview leads (lastActivityAt or createdAt).',
      'This response is an operational summary — not a PV-safe or embed-facing contract.',
    ];
    if (truncated) {
      caveats.push(`List truncated to the first ${MAX_BOTS_SUMMARY_ROWS} bots after sorting by activity (use filters in a future slice).`);
    }

    return {
      schemaVersion: 1 as const,
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        label,
      },
      truncated,
      bots: rows.slice(0, MAX_BOTS_SUMMARY_ROWS),
      caveats,
    };
  }

  /**
   * Single-bot internal analytics — excludes {@link Bot.secretKey} and other secret material.
   */
  async getBotAnalyticsDetail(botId: string, query: OverviewDateRangeQuery) {
    if (!Types.ObjectId.isValid(botId)) {
      throw new NotFoundException('Bot not found');
    }
    const { from, to, label } = parseOverviewDateRange(query);
    const oid = new Types.ObjectId(botId);
    const evRange = { createdAt: { $gte: from, $lte: to } };

    const botDoc = await this.botModel
      .findById(oid)
      .select('-secretKey -openaiApiKeyOverride -whisperApiKeyOverride -personality.systemPrompt')
      .lean();
    if (!botDoc) {
      throw new NotFoundException('Bot not found');
    }

    const [msgAgg, convAgg, leadCountRows, lastTouchRows] = await Promise.all([
      this.messageModel.aggregate<{
        messageCount: number;
        showcaseRuntimeUserMessages: number;
        trialRuntimeUserMessages: number;
        lastMessageAt: Date | null;
      }>([
        { $match: { botId: oid, ...evRange } },
        {
          $group: {
            _id: null,
            messageCount: { $sum: 1 },
            showcaseRuntimeUserMessages: {
              $sum: {
                $cond: [
                  {
                    $and: [{ $eq: ['$role', 'user'] }, { $eq: ['$showcaseRuntimeUserMessage', true] }],
                  },
                  1,
                  0,
                ],
              },
            },
            trialRuntimeUserMessages: {
              $sum: {
                $cond: [
                  {
                    $and: [{ $eq: ['$role', 'user'] }, { $eq: ['$trialRuntimeUserMessage', true] }],
                  },
                  1,
                  0,
                ],
              },
            },
            lastMessageAt: { $max: '$createdAt' },
          },
        },
      ]),
      this.conversationModel.aggregate<{ conversationCount: number; lastConversationCreatedAt: Date | null }>([
        { $match: { botId: oid, ...evRange } },
        {
          $group: {
            _id: null,
            conversationCount: { $sum: 1 },
            lastConversationCreatedAt: { $max: '$createdAt' },
          },
        },
      ]),
      this.conversationModel.aggregate<{ n: number }>([
        { $match: { botId: oid } },
        {
          $match: {
            $or: [
              { lastActivityAt: { $gte: from, $lte: to } },
              { lastActivityAt: { $exists: false }, createdAt: { $gte: from, $lte: to } },
            ],
          },
        },
        this.hasNonEmptyCapturedLeadPipelineStage(),
        { $count: 'n' },
      ]),
      this.conversationModel.aggregate<{ lastAt: Date | null }>([
        {
          $match: {
            botId: oid,
            $or: [
              { lastActivityAt: { $gte: from, $lte: to } },
              { lastActivityAt: { $exists: false }, createdAt: { $gte: from, $lte: to } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            lastAt: { $max: { $ifNull: ['$lastActivityAt', '$createdAt'] } },
          },
        },
      ]),
    ]);

    const m0 = msgAgg[0];
    const c0 = convAgg[0];
    const leadConversationsWithCapturedLeads = leadCountRows[0]?.n ?? 0;
    const lastConversationActivityAtInRange = lastTouchRows[0]?.lastAt ?? null;

    const createdAt =
      botDoc.createdAt instanceof Date
        ? botDoc.createdAt.toISOString()
        : new Date(botDoc.createdAt as Date).toISOString();

    const caveats: string[] = [
      'Internal operator view — not for PV clients. secretKey and API key fields are never returned.',
      'Lead conversation count uses the same touched-in-range + non-empty capturedLeadData rule as overview.',
    ];

    return {
      schemaVersion: 1 as const,
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        label,
      },
      bot: {
        botId: String(botDoc._id),
        name: botDoc.name,
        slug: botDoc.slug,
        type: botDoc.type,
        status: botDoc.status ?? 'draft',
        visibility: botDoc.visibility ?? 'public',
        isPublic: Boolean(botDoc.isPublic),
        shortDescription: botDoc.shortDescription ?? null,
        category: botDoc.category ?? null,
        leadCaptureEnabled: botDoc.leadCapture?.enabled === true,
        createdAt,
        creatorType: botDoc.creatorType ?? null,
      },
      metrics: {
        messageCount: m0?.messageCount ?? 0,
        conversationCount: c0?.conversationCount ?? 0,
        showcaseRuntimeUserMessages: m0?.showcaseRuntimeUserMessages ?? 0,
        trialRuntimeUserMessages: m0?.trialRuntimeUserMessages ?? 0,
        conversationsWithCapturedLeads: leadConversationsWithCapturedLeads,
      },
      activity: {
        lastMessageAtInRange: m0?.lastMessageAt ? new Date(m0.lastMessageAt).toISOString() : null,
        lastConversationCreatedAtInRange: c0?.lastConversationCreatedAt
          ? new Date(c0.lastConversationCreatedAt).toISOString()
          : null,
        lastConversationActivityAtInRange: lastConversationActivityAtInRange
          ? new Date(lastConversationActivityAtInRange).toISOString()
          : null,
      },
      caveats,
    };
  }

  /** Aggregate lead metrics for the internal dashboard (counts only — no raw lead values). */
  async getLeadsSummary(query: OverviewDateRangeQuery) {
    const { from, to, label } = parseOverviewDateRange(query);
    const [conversationsWithCapturedLeads, totalLeadFieldsCaptured, byBotRaw] = await Promise.all([
      this.countConversationsWithCapturedLeadsInRange(from, to),
      this.sumNonEmptyLeadFieldValuesInRange(from, to),
      this.aggregateLeadsByBot(from, to),
    ]);

    const sorted = [...byBotRaw].sort((a, b) => b.conversationsWithCapturedLeads - a.conversationsWithCapturedLeads);
    const top = sorted.slice(0, MAX_LEADS_BY_BOT_ROWS);
    const botIds = top.map((r) => new Types.ObjectId(r.botId));
    const botDocs = await this.botModel
      .find({ _id: { $in: botIds } })
      .select('name slug')
      .lean();
    const nameById = new Map(botDocs.map((b) => [String(b._id), { name: b.name, slug: b.slug }]));

    const byBot = top.map((r) => {
      const meta = nameById.get(r.botId);
      return {
        botId: r.botId,
        name: meta?.name ?? '(unknown bot)',
        slug: meta?.slug ?? '',
        conversationsWithCapturedLeads: r.conversationsWithCapturedLeads,
        leadFieldsCaptured: r.leadFieldsCaptured,
      };
    });

    const truncatedByBot = sorted.length > MAX_LEADS_BY_BOT_ROWS;
    const caveats: string[] = [
      'Counts only — raw lead field values are not included (PII). totalLeadFieldsCaptured sums non-empty values across qualifying conversations.',
      'Conversation “in range” for leads matches overview: lastActivityAt in range or missing lastActivityAt with createdAt in range.',
    ];
    if (truncatedByBot) {
      caveats.push(`byBot lists the top ${MAX_LEADS_BY_BOT_ROWS} bots by conversations with captured leads.`);
    }

    return {
      schemaVersion: 1 as const,
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        label,
      },
      totals: {
        conversationsWithCapturedLeads,
        totalLeadFieldsCaptured,
      },
      byBot,
      caveats,
    };
  }

  /**
   * Conversations with lead data touched in range — uses {@link Conversation.lastActivityAt} when set.
   */
  private async countConversationsWithCapturedLeadsInRange(from: Date, to: Date): Promise<number> {
    const rows = await this.conversationModel.aggregate<{ n: number }>([
      this.conversationTouchedInRangeStage(from, to),
      this.hasNonEmptyCapturedLeadPipelineStage(),
      { $count: 'n' },
    ]);
    return rows[0]?.n ?? 0;
  }

  private conversationTouchedInRangeStage(from: Date, to: Date) {
    return {
      $match: {
        $or: [
          { lastActivityAt: { $gte: from, $lte: to } },
          { lastActivityAt: { $exists: false }, createdAt: { $gte: from, $lte: to } },
        ],
      },
    };
  }

  /** $match stage: at least one non-empty string value in capturedLeadData. */
  private hasNonEmptyCapturedLeadPipelineStage() {
    return {
      $match: {
        $expr: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $objectToArray: { $ifNull: ['$capturedLeadData', {}] } },
                  as: 'pair',
                  cond: { $gt: [{ $strLenCP: { $ifNull: ['$$pair.v', ''] } }, 0] },
                },
              },
            },
            0,
          ],
        },
      },
    };
  }

  private async sumNonEmptyLeadFieldValuesInRange(from: Date, to: Date): Promise<number> {
    const rows = await this.conversationModel.aggregate<{ total: number }>([
      this.conversationTouchedInRangeStage(from, to),
      this.hasNonEmptyCapturedLeadPipelineStage(),
      {
        $project: {
          nonEmptyFieldCount: {
            $size: {
              $filter: {
                input: { $objectToArray: { $ifNull: ['$capturedLeadData', {}] } },
                as: 'pair',
                cond: { $gt: [{ $strLenCP: { $ifNull: ['$$pair.v', ''] } }, 0] },
              },
            },
          },
        },
      },
      { $group: { _id: null, total: { $sum: '$nonEmptyFieldCount' } } },
    ]);
    return rows[0]?.total ?? 0;
  }

  private async aggregateLeadsByBot(
    from: Date,
    to: Date,
  ): Promise<
    Array<{ botId: string; conversationsWithCapturedLeads: number; leadFieldsCaptured: number }>
  > {
    const rows = await this.conversationModel.aggregate<{
      _id: Types.ObjectId;
      conversationsWithCapturedLeads: number;
      leadFieldsCaptured: number;
    }>([
      this.conversationTouchedInRangeStage(from, to),
      this.hasNonEmptyCapturedLeadPipelineStage(),
      {
        $project: {
          botId: '$botId',
          nonEmptyFieldCount: {
            $size: {
              $filter: {
                input: { $objectToArray: { $ifNull: ['$capturedLeadData', {}] } },
                as: 'pair',
                cond: { $gt: [{ $strLenCP: { $ifNull: ['$$pair.v', ''] } }, 0] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: '$botId',
          conversationsWithCapturedLeads: { $sum: 1 },
          leadFieldsCaptured: { $sum: '$nonEmptyFieldCount' },
        },
      },
    ]);
    return rows.map((r) => ({
      botId: String(r._id),
      conversationsWithCapturedLeads: r.conversationsWithCapturedLeads,
      leadFieldsCaptured: r.leadFieldsCaptured,
    }));
  }
}
