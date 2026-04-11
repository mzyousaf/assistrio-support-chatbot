import { createHash, randomBytes } from 'crypto';
import { HttpException, HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Bot,
  Conversation,
  Message,
  TrialAccessToken,
  TrialDashboardSession,
  TrialEmailWorkspace,
  TrialOnboardingDraft,
  Visitor,
  VisitorEvent,
} from '../models';
import { uploadPublic } from '../lib/s3';
import {
  createEmptyTrialOnboardingDraftMongoFields,
  parseTrialOnboardingDraftPatch,
  trialOnboardingDraftDocToApi,
  type TrialWorkspaceDraftV3Api,
} from './trial-onboarding-draft-api.util';
import {
  TRIAL_MAX_AVATAR_FILE_BYTES,
  TRIAL_MAX_KNOWLEDGE_DOCUMENTS,
  TRIAL_MAX_KNOWLEDGE_DOCUMENTS_TOTAL_BYTES,
  TRIAL_MAX_KNOWLEDGE_FILE_BYTES,
} from './trial-knowledge-limits';
import type { TrialEmailWorkspaceDocument, VisitorEventType, VisitorKind } from '../models';
/** Platform visitor: live chat on showcase (authenticated) bots — runtime embed. */
export const PLATFORM_VISITOR_SHOWCASE_RUNTIME_USER_MESSAGE_CAP = 30;

/** Platform visitor: live chat on trial (visitor) bots — runtime embed. */
export const PLATFORM_VISITOR_TRIAL_RUNTIME_USER_MESSAGE_CAP = 30;

/** Platform visitor: all preview chat (`/api/widget/preview/chat`). */
export const PLATFORM_VISITOR_PREVIEW_USER_MESSAGE_CAP = 50;

/** @deprecated Use {@link PLATFORM_VISITOR_TRIAL_RUNTIME_USER_MESSAGE_CAP}. */
export const PLATFORM_VISITOR_GLOBAL_USER_MESSAGE_CAP = PLATFORM_VISITOR_TRIAL_RUNTIME_USER_MESSAGE_CAP;

/** Magic-link lifetime for landing “request access” (hours). */
export const LANDING_TRIAL_ACCESS_TOKEN_TTL_HOURS = 48;

/** Dashboard session after successful magic-link verify (days). httpOnly cookie + Mongo row (hashed). */
export const TRIAL_DASHBOARD_SESSION_TTL_DAYS = 14;

/**
 * Upsert updates: MongoDB rejects the same path in `$set` and `$setOnInsert` when both apply on insert
 * (e.g. `categories` from defaults vs PATCH profile).
 */
function omitOverlappingKeys(
  insertDefaults: Record<string, unknown>,
  setPatch: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...insertDefaults };
  for (const k of Object.keys(setPatch)) {
    delete out[k];
  }
  return out;
}

function normalizeTrialEmail(e: string): string {
  return String(e ?? '')
    .trim()
    .toLowerCase();
}

/** Merge loser draft fields into winner when winner is empty — avoids losing data when deduping legacy session-bound drafts. */
function mergeTrialOnboardingDraftLosersIntoWinner(
  winner: Record<string, unknown>,
  losers: Record<string, unknown>[],
): void {
  const emptyScalar = (v: unknown) => v == null || v === '';
  const emptyArr = (v: unknown) => !Array.isArray(v) || v.length === 0;
  for (const l of losers) {
    const keys = [
      'agentName',
      'avatarUrl',
      'avatarByUpload',
      'avatarByUserURL',
      'brandColor',
      'describeAgent',
      'allowedWebsite',
      'allowedDomainsExtra',
      'currentStepId',
      'lastUpdatedStepId',
      'schemaVersion',
    ] as const;
    for (const k of keys) {
      if (emptyScalar(winner[k]) && !emptyScalar(l[k])) winner[k] = l[k];
    }
    if (emptyArr(winner.categories) && !emptyArr(l.categories)) winner.categories = l.categories;
    if (emptyArr(winner.quickLinks) && !emptyArr(l.quickLinks)) winner.quickLinks = l.quickLinks;
    if (!winner.behavior && l.behavior) winner.behavior = l.behavior;
    if (!winner.knowledge && l.knowledge) winner.knowledge = l.knowledge;
    if (emptyScalar(winner.trialAgent) && l.trialAgent) winner.trialAgent = l.trialAgent;
    if (emptyArr(winner.uploadedAssets) && !emptyArr(l.uploadedAssets)) winner.uploadedAssets = l.uploadedAssets;
    const wOnce = winner.setupStepOnceCompleted as boolean[] | undefined;
    const lOnce = l.setupStepOnceCompleted as boolean[] | undefined;
    if (Array.isArray(wOnce) && Array.isArray(lOnce) && lOnce.length === 4) {
      winner.setupStepOnceCompleted = wOnce.map((b, i) => Boolean(b || lOnce[i]));
    }
    const wMax = winner.setupExplicitMaxStepIndex as number | undefined;
    const lMax = l.setupExplicitMaxStepIndex as number | undefined;
    if (typeof lMax === 'number' && (wMax == null || lMax > wMax)) winner.setupExplicitMaxStepIndex = lMax;
    if (winner.knowledgeContinued !== true && l.knowledgeContinued === true) winner.knowledgeContinued = true;
    if (winner.onboardingCompleted !== true && l.onboardingCompleted === true) winner.onboardingCompleted = true;
  }
}

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

/** Browsers often send `application/octet-stream`; infer from filename for validation + S3 Content-Type. */
function inferTrialKnowledgeDocMime(originalFilename: string, reportedMime: string): string {
  const r = (reportedMime || '').trim().toLowerCase();
  if (r && r !== 'application/octet-stream' && r !== 'binary/octet-stream') {
    return reportedMime.trim().slice(0, 200);
  }
  const lower = originalFilename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  if (lower.endsWith('.csv')) return 'text/csv';
  return reportedMime.trim().slice(0, 200) || 'application/octet-stream';
}

@Injectable()
export class VisitorsService implements OnModuleInit {
  private readonly logger = new Logger(VisitorsService.name);

  constructor(
    @InjectModel(Visitor.name) private readonly visitorModel: Model<Visitor>,
    @InjectModel(VisitorEvent.name) private readonly visitorEventModel: Model<VisitorEvent>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(TrialAccessToken.name) private readonly trialAccessTokenModel: Model<TrialAccessToken>,
    @InjectModel(TrialDashboardSession.name)
    private readonly trialDashboardSessionModel: Model<TrialDashboardSession>,
    @InjectModel(TrialEmailWorkspace.name)
    private readonly trialEmailWorkspaceModel: Model<TrialEmailWorkspace>,
    @InjectModel(TrialOnboardingDraft.name)
    private readonly trialOnboardingDraftModel: Model<TrialOnboardingDraft>,
  ) { }

  async onModuleInit(): Promise<void> {
    await this.migrateLegacyTrialDraftsToEmailWorkspaces();
  }

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

  /**
   * Landing funnel: upsert platform visitor name/email, persist hashed magic-link token for later verification.
   * Returns the **raw** opaque token once — caller must deliver it only over email, not to browsers directly.
   */
  async issueLandingTrialAccessToken(input: {
    platformVisitorId: string;
    name: string;
    emailNormalized: string;
    ctaContext: Record<string, unknown>;
  }): Promise<{ rawToken: string; expiresAt: Date }> {
    const pv = String(input.platformVisitorId ?? '').trim();
    const name = String(input.name ?? '').trim().slice(0, 120);
    const emailNormalized = String(input.emailNormalized ?? '').trim().toLowerCase();
    if (!pv || !name || !emailNormalized) {
      throw new Error('platformVisitorId, name, and email are required.');
    }

    await this.getOrCreateVisitor(pv);
    const now = new Date();
    await this.visitorModel.findOneAndUpdate(
      platformVisitorFilter(pv),
      {
        $set: {
          name,
          email: emailNormalized,
          visitorType: 'platform',
          lastSeenAt: now,
        },
      },
      { new: true },
    );

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
    const expiresAt = new Date(now.getTime() + LANDING_TRIAL_ACCESS_TOKEN_TTL_HOURS * 3600 * 1000);

    await this.trialAccessTokenModel.create({
      platformVisitorId: pv,
      tokenHash,
      expiresAt,
      consumedAt: null,
      emailNormalized,
      name,
      ctaContext: input.ctaContext,
    });

    return { rawToken, expiresAt };
  }

  /**
   * Validates magic link: hash raw token, atomically consume row if valid and unexpired, issue dashboard session.
   * Raw token is not stored; only used to compute hash for this request.
   */
  async verifyLandingTrialMagicLink(rawToken: string): Promise<{ sessionToken: string; maxAgeSeconds: number }> {
    const trimmed = String(rawToken ?? '').trim();
    if (!trimmed || trimmed.length > 200) {
      throw new HttpException(
        { error: 'This link is not valid.', errorCode: 'TOKEN_INVALID' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const tokenHash = createHash('sha256').update(trimmed, 'utf8').digest('hex');
    const now = new Date();

    const consumed = await this.trialAccessTokenModel.findOneAndUpdate(
      { tokenHash, consumedAt: null, expiresAt: { $gt: now } },
      { $set: { consumedAt: now } },
      { new: true },
    );

    if (consumed) {
      const rawSession = randomBytes(32).toString('base64url');
      const sessionTokenHash = createHash('sha256').update(rawSession, 'utf8').digest('hex');
      const maxAgeSeconds = TRIAL_DASHBOARD_SESSION_TTL_DAYS * 24 * 3600;
      const expiresAt = new Date(now.getTime() + maxAgeSeconds * 1000);
      await this.trialDashboardSessionModel.create({
        sessionTokenHash,
        platformVisitorId: consumed.platformVisitorId,
        emailNormalized: consumed.emailNormalized,
        name: consumed.name,
        expiresAt,
      });
      return { sessionToken: rawSession, maxAgeSeconds };
    }

    const doc = await this.trialAccessTokenModel.findOne({ tokenHash }).lean();
    if (!doc) {
      throw new HttpException(
        { error: 'This link is not valid.', errorCode: 'TOKEN_INVALID' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (doc.consumedAt) {
      throw new HttpException(
        {
          error: 'This link was already used. Request a new access link from the homepage.',
          errorCode: 'TOKEN_USED',
        },
        HttpStatus.CONFLICT,
      );
    }
    if (doc.expiresAt <= now) {
      throw new HttpException(
        {
          error: 'This link has expired. Request a new access link to continue.',
          errorCode: 'TOKEN_EXPIRED',
        },
        HttpStatus.GONE,
      );
    }

    throw new HttpException(
      { error: 'This link is not valid.', errorCode: 'TOKEN_INVALID' },
      HttpStatus.BAD_REQUEST,
    );
  }

  async validateTrialDashboardSession(
    rawSessionToken: string,
  ): Promise<{ platformVisitorId: string; emailNormalized: string; name?: string; expiresAt: Date } | null> {
    const trimmed = String(rawSessionToken ?? '').trim();
    if (!trimmed || trimmed.length > 200) return null;
    const sessionTokenHash = createHash('sha256').update(trimmed, 'utf8').digest('hex');
    const now = new Date();
    const row = await this.trialDashboardSessionModel
      .findOne({ sessionTokenHash, expiresAt: { $gt: now } })
      .lean();
    if (!row) return null;
    return {
      platformVisitorId: row.platformVisitorId,
      emailNormalized: row.emailNormalized,
      name: row.name,
      expiresAt: row.expiresAt,
    };
  }

  /**
   * Resolves a raw dashboard session cookie token to session context + hash.
   * Used for trial onboarding draft APIs (authorization is the session row, not `platformVisitorId` alone).
   */
  private async resolveTrialDashboardSessionForDraftOrThrow(rawSessionToken: string): Promise<{
    sessionTokenHash: string;
    platformVisitorId: string;
    emailNormalized: string;
    sessionDocId: Types.ObjectId;
  }> {
    const trimmed = String(rawSessionToken ?? '').trim();
    if (!trimmed || trimmed.length > 200) {
      throw new HttpException(
        { error: 'Invalid or expired session', errorCode: 'SESSION_INVALID' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const sessionTokenHash = createHash('sha256').update(trimmed, 'utf8').digest('hex');
    const now = new Date();
    const row = await this.trialDashboardSessionModel
      .findOne({ sessionTokenHash, expiresAt: { $gt: now } })
      .lean();
    if (!row?._id) {
      throw new HttpException(
        { error: 'Invalid or expired session', errorCode: 'SESSION_INVALID' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return {
      sessionTokenHash,
      platformVisitorId: row.platformVisitorId,
      emailNormalized: row.emailNormalized,
      sessionDocId: row._id as Types.ObjectId,
    };
  }

  /**
   * Stable workspace per normalized email — one onboarding draft per workspace.
   */
  private async getOrCreateEmailWorkspace(
    emailNormalized: string,
    platformVisitorId: string,
  ): Promise<TrialEmailWorkspaceDocument> {
    const email = normalizeTrialEmail(emailNormalized);
    if (!email) {
      throw new HttpException(
        { error: 'Missing email on session', errorCode: 'SESSION_INVALID' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const row = await this.trialEmailWorkspaceModel
      .findOneAndUpdate(
        { emailNormalized: email },
        {
          $set: { platformVisitorId, updatedAt: new Date() },
          $setOnInsert: { emailNormalized: email },
        },
        { upsert: true, new: true },
      )
      .exec();
    if (!row) {
      throw new HttpException(
        { error: 'Could not resolve trial workspace', errorCode: 'WORKSPACE_MISSING' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return row as TrialEmailWorkspaceDocument;
  }

  private buildTrialDraftInsertDefaults(
    ctx: { platformVisitorId: string; emailNormalized: string; sessionDocId: Types.ObjectId },
    trialWorkspaceId: Types.ObjectId,
  ): Record<string, unknown> {
    return {
      trialWorkspaceId,
      platformVisitorId: ctx.platformVisitorId,
      emailNormalized: normalizeTrialEmail(ctx.emailNormalized),
      trialDashboardSessionId: ctx.sessionDocId,
      ...createEmptyTrialOnboardingDraftMongoFields(),
    };
  }

  /**
   * One-time migration: legacy drafts keyed by session → single draft per email via {@link TrialEmailWorkspace}.
   */
  private async migrateLegacyTrialDraftsToEmailWorkspaces(): Promise<void> {
    try {
      await this.trialEmailWorkspaceModel.syncIndexes();
      await this.trialOnboardingDraftModel.syncIndexes();
    } catch (e) {
      this.logger.warn(`syncIndexes: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      await this.trialOnboardingDraftModel.collection.dropIndex('sessionTokenHash_1');
    } catch {
      /* no legacy unique index */
    }
    try {
      const all = await this.trialOnboardingDraftModel.find({}).lean();
      const byEmail = new Map<string, Record<string, unknown>[]>();
      for (const d of all) {
        const rec = d as Record<string, unknown>;
        const email = normalizeTrialEmail(String(rec.emailNormalized ?? ''));
        if (!email) continue;
        if (!byEmail.has(email)) byEmail.set(email, []);
        byEmail.get(email)!.push(rec);
      }

      for (const [email, group] of byEmail) {
        const ws = await this.getOrCreateEmailWorkspace(email, String(group[0].platformVisitorId ?? ''));
        const wsId = ws._id as Types.ObjectId;

        if (group.length === 1) {
          const d = group[0];
          if (d.trialWorkspaceId && String(d.trialWorkspaceId) === String(wsId) && !d.sessionTokenHash) {
            continue;
          }
          if (d.trialWorkspaceId && String(d.trialWorkspaceId) === String(wsId) && d.sessionTokenHash) {
            await this.trialOnboardingDraftModel.updateOne(
              { _id: d._id },
              { $unset: { sessionTokenHash: '' } },
            );
            continue;
          }
          await this.trialOnboardingDraftModel.updateOne(
            { _id: d._id },
            { $set: { trialWorkspaceId: wsId }, $unset: { sessionTokenHash: '' } },
          );
          continue;
        }

        group.sort((a, b) => {
          const ta =
            a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(String(a.updatedAt ?? 0)).getTime();
          const tb =
            b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(String(b.updatedAt ?? 0)).getTime();
          return tb - ta;
        });
        const winner = { ...group[0] };
        const losers = group.slice(1);
        mergeTrialOnboardingDraftLosersIntoWinner(winner, losers);
        const loserIds = losers.map((l) => l._id).filter(Boolean);

        const $set: Record<string, unknown> = { trialWorkspaceId: wsId };
        for (const k of Object.keys(winner)) {
          if (k === '_id' || k === '__v' || k === 'sessionTokenHash') continue;
          const v = winner[k];
          if (v !== undefined) $set[k] = v;
        }
        await this.trialOnboardingDraftModel.updateOne({ _id: winner._id }, { $set, $unset: { sessionTokenHash: '' } });
        if (loserIds.length > 0) {
          await this.trialOnboardingDraftModel.deleteMany({ _id: { $in: loserIds } });
        }
        this.logger.log(
          `Migrated ${group.length} trial draft(s) for ${email} → workspace ${String(wsId)} (kept latest + merged)`,
        );
      }
    } catch (e) {
      this.logger.error(
        `migrateLegacyTrialDraftsToEmailWorkspaces failed: ${e instanceof Error ? e.stack : String(e)}`,
      );
    }
  }

  async getTrialOnboardingDraftForSessionToken(rawSessionToken: string) {
    const ctx = await this.resolveTrialDashboardSessionForDraftOrThrow(rawSessionToken);
    const ws = await this.getOrCreateEmailWorkspace(ctx.emailNormalized, ctx.platformVisitorId);
    const wsId = ws._id as Types.ObjectId;
    const insertDefaults = this.buildTrialDraftInsertDefaults(ctx, wsId);
    const doc = await this.trialOnboardingDraftModel
      .findOneAndUpdate(
        { trialWorkspaceId: wsId },
        { $setOnInsert: insertDefaults },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
    const updatedAt =
      doc && typeof doc === 'object' && 'updatedAt' in doc && doc.updatedAt instanceof Date
        ? doc.updatedAt
        : new Date();
    return {
      ok: true as const,
      draft: trialOnboardingDraftDocToApi(doc as Record<string, unknown>, updatedAt),
    };
  }

  async patchTrialOnboardingDraftForSessionToken(rawSessionToken: string, body: unknown) {
    const ctx = await this.resolveTrialDashboardSessionForDraftOrThrow(rawSessionToken);
    const ws = await this.getOrCreateEmailWorkspace(ctx.emailNormalized, ctx.platformVisitorId);
    const wsId = ws._id as Types.ObjectId;
    const patch = parseTrialOnboardingDraftPatch(body);
    const insertDefaults = this.buildTrialDraftInsertDefaults(ctx, wsId);
    // Upsert: MongoDB forbids the same path in both `$set` and `$setOnInsert` on insert (e.g. `categories`).
    const setOnInsert = omitOverlappingKeys(insertDefaults, patch.set);
    const update: Record<string, unknown> = { $setOnInsert: setOnInsert };
    if (Object.keys(patch.set).length > 0) {
      update.$set = patch.set;
    }
    if (patch.unset && Object.keys(patch.unset).length > 0) {
      update.$unset = patch.unset;
    }
    const doc = await this.trialOnboardingDraftModel
      .findOneAndUpdate({ trialWorkspaceId: wsId }, update, { upsert: true, new: true, setDefaultsOnInsert: true })
      .lean();
    const updatedAt =
      doc && typeof doc === 'object' && 'updatedAt' in doc && doc.updatedAt instanceof Date
        ? doc.updatedAt
        : new Date();
    return {
      ok: true as const,
      draft: trialOnboardingDraftDocToApi(doc as Record<string, unknown>, updatedAt),
    };
  }

  /**
   * Upserts the onboarding draft for this session’s email workspace and returns the lean document (for agent creation).
   */
  async ensureTrialDraftLeanBySession(rawSessionToken: string): Promise<Record<string, unknown>> {
    const ctx = await this.resolveTrialDashboardSessionForDraftOrThrow(rawSessionToken);
    const ws = await this.getOrCreateEmailWorkspace(ctx.emailNormalized, ctx.platformVisitorId);
    const wsId = ws._id as Types.ObjectId;
    const insertDefaults = this.buildTrialDraftInsertDefaults(ctx, wsId);
    const doc = await this.trialOnboardingDraftModel
      .findOneAndUpdate(
        { trialWorkspaceId: wsId },
        { $setOnInsert: insertDefaults },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
    return doc as Record<string, unknown>;
  }

  async setTrialAgentOnDraft(
    rawSessionToken: string,
    snapshot: {
      botId: string;
      slug: string;
      accessKey: string;
      name: string;
      imageUrl?: string;
      allowedDomain: string;
      createdAt: Date;
    },
  ): Promise<void> {
    const ctx = await this.resolveTrialDashboardSessionForDraftOrThrow(rawSessionToken);
    const ws = await this.getOrCreateEmailWorkspace(ctx.emailNormalized, ctx.platformVisitorId);
    const wsId = ws._id as Types.ObjectId;
    await this.trialOnboardingDraftModel.updateOne(
      { trialWorkspaceId: wsId },
      { $set: { trialAgent: snapshot, onboardingCompleted: true } },
    );
  }

  /**
   * When a trial agent already exists, mirror draft avatar upload onto the visitor bot (playground profile).
   */
  private async applyTrialBotAvatarImageFromUpload(
    platformVisitorId: string,
    botId: string,
    url: string,
  ): Promise<void> {
    const bid = String(botId ?? '').trim();
    if (!Types.ObjectId.isValid(bid)) return;
    const bot = (await this.botModel.findById(new Types.ObjectId(bid)).lean()) as Record<string, unknown> | null;
    if (!bot || String(bot.type ?? '') !== 'visitor-own') return;
    const owner = String((bot.ownerVisitorId as string | undefined) ?? '').trim();
    if (owner !== String(platformVisitorId ?? '').trim()) return;
    const chatUI = { ...((bot.chatUI ?? {}) as Record<string, unknown>) };
    chatUI.launcherAvatarUrl = url;
    await this.botModel.updateOne({ _id: new Types.ObjectId(bid) }, { $set: { imageUrl: url, chatUI } });
  }

  /**
   * Uploads onboarding asset to S3 and merges metadata into the trial draft (same session auth as draft APIs).
   */
  async uploadTrialOnboardingAsset(
    rawSessionToken: string,
    params: {
      buffer: Buffer;
      originalFilename: string;
      mimeType: string;
      kind: 'avatar' | 'knowledge_document';
    },
  ): Promise<{ ok: true; draft: TrialWorkspaceDraftV3Api }> {
    const ctx = await this.resolveTrialDashboardSessionForDraftOrThrow(rawSessionToken);
    const maxBytes = params.kind === 'avatar' ? TRIAL_MAX_AVATAR_FILE_BYTES : TRIAL_MAX_KNOWLEDGE_FILE_BYTES;
    if (params.buffer.length > maxBytes) {
      throw new HttpException(
        {
          error:
            params.kind === 'avatar' ? 'Avatar file is too large (max 2MB).' : 'File is too large (max 5MB).',
          errorCode: 'FILE_TOO_LARGE',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const resolvedMime =
      params.kind === 'knowledge_document'
        ? inferTrialKnowledgeDocMime(params.originalFilename, params.mimeType)
        : params.mimeType.toLowerCase();
    const mime = resolvedMime.toLowerCase();
    if (params.kind === 'avatar') {
      if (!/^image\/(jpeg|png|webp)$/i.test(mime)) {
        throw new HttpException(
          { error: 'Avatar must be JPEG, PNG, or WebP.', errorCode: 'INVALID_FILE_TYPE' },
          HttpStatus.BAD_REQUEST,
        );
      }
    } else {
      const docMimes = new Set([
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/html',
        'text/csv',
      ]);
      if (!docMimes.has(mime)) {
        throw new HttpException(
          { error: 'Unsupported document type for upload.', errorCode: 'INVALID_FILE_TYPE' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const prefix = params.kind === 'avatar' ? 'trial-onboarding/avatars' : 'trial-onboarding/knowledge-docs';
    let upload: { key: string; url: string };
    try {
      upload = await uploadPublic({
        prefix,
        body: params.buffer,
        originalName: params.originalFilename,
        contentType: params.kind === 'knowledge_document' ? resolvedMime : params.mimeType,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      throw new HttpException(
        { error: msg, errorCode: 'UPLOAD_FAILED' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const asset = {
      kind: params.kind,
      assetKey: upload.key,
      originalFilename: params.originalFilename.slice(0, 500),
      mimeType: (params.kind === 'knowledge_document' ? resolvedMime : params.mimeType).slice(0, 200),
      sizeBytes: params.buffer.length,
      uploadedAt: new Date(),
      url: upload.url,
    };

    const ws = await this.getOrCreateEmailWorkspace(ctx.emailNormalized, ctx.platformVisitorId);
    const wsId = ws._id as Types.ObjectId;
    const insertDefaults = this.buildTrialDraftInsertDefaults(ctx, wsId);
    const afterEnsure = await this.trialOnboardingDraftModel
      .findOneAndUpdate(
        { trialWorkspaceId: wsId },
        { $setOnInsert: insertDefaults },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
    const prevAssets = Array.isArray((afterEnsure as { uploadedAssets?: unknown[] })?.uploadedAssets)
      ? [...((afterEnsure as { uploadedAssets: unknown[] }).uploadedAssets as Record<string, unknown>[])]
      : [];
    let nextAssets: Record<string, unknown>[];
    if (params.kind === 'avatar') {
      nextAssets = prevAssets.filter((a) => (a as { kind?: string }).kind !== 'avatar');
      nextAssets.push(asset);
    } else {
      const knowledgeExisting = prevAssets.filter((a) => (a as { kind?: string }).kind === 'knowledge_document');
      if (knowledgeExisting.length >= TRIAL_MAX_KNOWLEDGE_DOCUMENTS) {
        throw new HttpException(
          {
            error: `You can upload at most ${TRIAL_MAX_KNOWLEDGE_DOCUMENTS} knowledge documents.`,
            errorCode: 'KNOWLEDGE_DOCUMENT_LIMIT',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      const totalKb = knowledgeExisting.reduce(
        (s, a) => s + (typeof (a as { sizeBytes?: unknown }).sizeBytes === 'number' ? (a as { sizeBytes: number }).sizeBytes : 0),
        0,
      );
      if (totalKb + params.buffer.length > TRIAL_MAX_KNOWLEDGE_DOCUMENTS_TOTAL_BYTES) {
        throw new HttpException(
          {
            error: 'Total size of knowledge documents cannot exceed 15 MB.',
            errorCode: 'KNOWLEDGE_DOCUMENTS_TOTAL_TOO_LARGE',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      nextAssets = [...prevAssets, asset];
    }

    const $set: Record<string, unknown> = { uploadedAssets: nextAssets };
    if (params.kind === 'avatar') {
      $set.avatarByUpload = {
        url: upload.url,
        assetKey: upload.key,
        originalFilename: asset.originalFilename,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        updatedAt: new Date(),
      };
    }

    const updated = await this.trialOnboardingDraftModel
      .findOneAndUpdate({ trialWorkspaceId: wsId }, { $set }, { new: true })
      .lean();
    if (!updated) {
      throw new HttpException({ error: 'Draft not found', errorCode: 'DRAFT_MISSING' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (params.kind === 'avatar') {
      const ta = (updated as { trialAgent?: { botId?: unknown } }).trialAgent;
      const botId = String(ta?.botId ?? '').trim();
      if (botId) {
        try {
          await this.applyTrialBotAvatarImageFromUpload(ctx.platformVisitorId, botId, upload.url);
        } catch (e) {
          console.error('[uploadTrialOnboardingAsset] sync avatar to trial bot', { botId, err: e });
        }
      }
    }

    const updatedAt =
      updated && typeof updated === 'object' && 'updatedAt' in updated && updated.updatedAt instanceof Date
        ? updated.updatedAt
        : new Date();
    return {
      ok: true as const,
      draft: trialOnboardingDraftDocToApi(updated as Record<string, unknown>, updatedAt),
    };
  }
}
