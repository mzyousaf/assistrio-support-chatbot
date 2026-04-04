import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bot, Conversation, Message, Visitor, VisitorEvent } from '../models';
import type { VisitorEventType, VisitorKind } from '../models';
/** Platform visitor: live chat on showcase (authenticated) bots — runtime embed. */
export const PLATFORM_VISITOR_SHOWCASE_RUNTIME_USER_MESSAGE_CAP = 30;

/** Platform visitor: live chat on trial (visitor) bots — runtime embed. */
export const PLATFORM_VISITOR_TRIAL_RUNTIME_USER_MESSAGE_CAP = 30;

/** Platform visitor: all preview chat (`/api/widget/preview/chat`). */
export const PLATFORM_VISITOR_PREVIEW_USER_MESSAGE_CAP = 50;

/** @deprecated Use {@link PLATFORM_VISITOR_TRIAL_RUNTIME_USER_MESSAGE_CAP}. */
export const PLATFORM_VISITOR_GLOBAL_USER_MESSAGE_CAP = PLATFORM_VISITOR_TRIAL_RUNTIME_USER_MESSAGE_CAP;

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
      trialPreviewUserMessageCount: 0,
      previewUserMessageCount: 0,
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

  /**
   * Trial bots only: counts persisted user messages with {@link Message.trialRuntimeUserMessage}
   * (runtime embed), capped at {@link PLATFORM_VISITOR_TRIAL_RUNTIME_USER_MESSAGE_CAP}.
   */
  async checkTrialVisitorRuntimeMessageQuota(platformVisitorId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
  }> {
    const limit = PLATFORM_VISITOR_TRIAL_RUNTIME_USER_MESSAGE_CAP;
    const current = await this.messageModel.countDocuments({
      visitorId: platformVisitorId,
      role: 'user',
      trialRuntimeUserMessage: true,
    });
    return { allowed: current < limit, current, limit };
  }

  /**
   * Showcase bots only: runtime embed user messages tagged {@link Message.showcaseRuntimeUserMessage}.
   * **Global bucket** — no `botId` in the query; same platform visitor shares one cap across showcase bots.
   */
  async checkShowcaseRuntimeMessageQuota(platformVisitorId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
  }> {
    const limit = PLATFORM_VISITOR_SHOWCASE_RUNTIME_USER_MESSAGE_CAP;
    const current = await this.messageModel.countDocuments({
      visitorId: platformVisitorId,
      role: 'user',
      showcaseRuntimeUserMessage: true,
    });
    return { allowed: current < limit, current, limit };
  }

  /**
   * Public-safe remaining usage for anonymous landing: preview vs runtime buckets are **separate**
   * (preview = visitor doc counters; trial/showcase runtime = message flags). No secrets.
   */
  async getPublicVisitorQuotaSummary(platformVisitorId: string): Promise<{
    preview: { limit: number; used: number; remaining: number };
    trialRuntime: { limit: number; used: number; remaining: number };
    showcaseRuntime: { limit: number; used: number; remaining: number };
  }> {
    const pv = String(platformVisitorId ?? '').trim();
    const preview = await this.checkPlatformVisitorPreviewMessageQuota(pv);
    const trialRuntime = await this.checkTrialVisitorRuntimeMessageQuota(pv);
    const showcaseRuntime = await this.checkShowcaseRuntimeMessageQuota(pv);
    const toRemaining = (limit: number, used: number) => Math.max(0, limit - used);
    return {
      preview: {
        limit: preview.limit,
        used: preview.current,
        remaining: toRemaining(preview.limit, preview.current),
      },
      trialRuntime: {
        limit: trialRuntime.limit,
        used: trialRuntime.current,
        remaining: toRemaining(trialRuntime.limit, trialRuntime.current),
      },
      showcaseRuntime: {
        limit: showcaseRuntime.limit,
        used: showcaseRuntime.current,
        remaining: toRemaining(showcaseRuntime.limit, showcaseRuntime.current),
      },
    };
  }

  private resolvePreviewMessageCount(v: Record<string, unknown> | null | undefined): number {
    if (!v) return 0;
    const a = Math.floor(Number(v.previewUserMessageCount ?? 0));
    const b = Math.floor(Number(v.trialPreviewUserMessageCount ?? 0));
    return Math.max(0, a + b);
  }

  async checkPlatformVisitorPreviewMessageQuota(platformVisitorId: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
  }> {
    const limit = PLATFORM_VISITOR_PREVIEW_USER_MESSAGE_CAP;
    const v = await this.visitorModel.findOne(platformVisitorFilter(platformVisitorId)).lean();
    const current = this.resolvePreviewMessageCount(v as Record<string, unknown> | undefined);
    return { allowed: current < limit, current, limit };
  }

  async incrementPlatformVisitorPreviewMessageCount(platformVisitorId: string): Promise<void> {
    await this.visitorModel.updateOne(platformVisitorFilter(platformVisitorId), {
      $inc: { previewUserMessageCount: 1 },
    });
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

  /**
   * PV-safe: find a **visitor-own** bot owned by this `platformVisitorId`, or `null`.
   * Does not expose secrets; selection is minimal for summary APIs.
   */
  async findPvOwnedVisitorOwnBot(
    platformVisitorId: string,
    botId: string,
  ): Promise<Record<string, unknown> | null> {
    const pv = String(platformVisitorId ?? '').trim();
    if (!botId || !Types.ObjectId.isValid(botId)) return null;
    const bot = await this.botModel
      .findOne({
        _id: new Types.ObjectId(botId),
        type: 'visitor-own',
        ownerVisitorId: pv,
      })
      .select(
        '_id name slug status type createdAt allowedDomains leadCapture messageLimitMode messageLimitTotal',
      )
      .lean();
    return bot ?? null;
  }

  /**
   * PV-safe product summary for an owned trial bot — not raw analytics events.
   * **Do not** reuse internal `AnalyticsService` dashboard shapes for these responses.
   *
   * @see docs/ANALYTICS_BOUNDARIES.md
   * @see docs/PV_SAFE_PUBLIC_APIS.md
   */
  async getPvSafeVisitorBotSummary(platformVisitorId: string, botId: string) {
    const bot = await this.findPvOwnedVisitorOwnBot(platformVisitorId, botId);
    if (!bot) return null;
    const quotas = await this.getPublicVisitorQuotaSummary(platformVisitorId);
    const oid = new Types.ObjectId(String(bot._id));
    const trialUsedOnBot = await this.messageModel.countDocuments({
      botId: oid,
      visitorId: platformVisitorId,
      role: 'user',
      trialRuntimeUserMessage: true,
    });
    const globalTrial = await this.checkTrialVisitorRuntimeMessageQuota(platformVisitorId);
    const messageLimitTotal =
      bot.messageLimitMode === 'fixed_total' && bot.messageLimitTotal != null
        ? Math.max(0, Math.floor(Number(bot.messageLimitTotal)))
        : null;
    const effectiveLimit =
      messageLimitTotal != null
        ? Math.min(globalTrial.limit, messageLimitTotal)
        : globalTrial.limit;
    const globalRemaining = Math.max(0, globalTrial.limit - globalTrial.current);
    const remainingForBot = Math.min(
      globalRemaining,
      Math.max(0, effectiveLimit - trialUsedOnBot),
    );
    const allowedDomains = (bot.allowedDomains as string[] | undefined) ?? [];
    const leadCapture = bot.leadCapture as { enabled?: boolean } | undefined;
    return {
      platformVisitorId,
      bot: {
        id: String(bot._id),
        name: String(bot.name ?? ''),
        slug: String(bot.slug ?? ''),
        status: String(bot.status ?? ''),
        type: 'visitor-own' as const,
        allowedDomains,
        allowedDomain: allowedDomains[0] ?? '',
        createdAt: (bot.createdAt as Date)?.toISOString?.() ?? null,
        leadCaptureEnabled: !!leadCapture?.enabled,
      },
      usage: {
        preview: quotas.preview,
        trialRuntime: {
          used: trialUsedOnBot,
          limit: effectiveLimit,
          remaining: remainingForBot,
        },
        showcaseRuntime: quotas.showcaseRuntime,
      },
    };
  }

  /**
   * PV-safe basic activity summary for an owned bot (counts + last activity).
   */
  async getPvSafeVisitorBotBasicInsights(platformVisitorId: string, botId: string) {
    const bot = await this.findPvOwnedVisitorOwnBot(platformVisitorId, botId);
    if (!bot) return null;
    const oid = new Types.ObjectId(String(bot._id));
    const leadCapture = bot.leadCapture as { enabled?: boolean } | undefined;
    const [conversationCount, messageCount, lastMsg] = await Promise.all([
      this.conversationModel.countDocuments({ botId: oid, visitorId: platformVisitorId }),
      this.messageModel.countDocuments({ botId: oid, visitorId: platformVisitorId }),
      this.messageModel
        .findOne({ botId: oid, visitorId: platformVisitorId })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean(),
    ]);
    return {
      platformVisitorId,
      botId: String(bot._id),
      conversationCount,
      messageCount,
      leadCaptureEnabled: !!leadCapture?.enabled,
      lastActivityAt: lastMsg?.createdAt ? (lastMsg.createdAt as Date).toISOString() : null,
    };
  }

  /**
   * PV-safe lead capture **aggregates** only — no field values (PII).
   */
  async getPvSafeVisitorBotLeadsSummary(platformVisitorId: string, botId: string) {
    const bot = await this.findPvOwnedVisitorOwnBot(platformVisitorId, botId);
    if (!bot) return null;
    const oid = new Types.ObjectId(String(bot._id));
    const convs = await this.conversationModel
      .find({ botId: oid, visitorId: platformVisitorId })
      .select('capturedLeadData')
      .lean();
    let conversationsWithCapturedLeads = 0;
    let totalLeadFieldsCaptured = 0;
    for (const c of convs) {
      const data = (c as { capturedLeadData?: Record<string, string> }).capturedLeadData;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const keys = Object.keys(data).filter((k) => String(data[k] ?? '').trim().length > 0);
        if (keys.length > 0) {
          conversationsWithCapturedLeads += 1;
          totalLeadFieldsCaptured += keys.length;
        }
      }
    }
    return {
      platformVisitorId,
      botId: String(bot._id),
      conversationsWithCapturedLeads,
      totalLeadFieldsCaptured,
    };
  }
}
