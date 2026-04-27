import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE } from '../models/bot.schema';
import {
  Bot,
  Conversation,
  DocumentModel,
  IngestJob,
  KnowledgeBaseChunk,
  KnowledgeBaseItem,
  Message,
  SummaryJob,
  User,
  VisitorEvent,
} from '../models';
import { getDefaultBotCreatePayload } from '../workspace/shared/default-new-bot.payload';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { generateBotAccessKey, generateBotSecretKey } from './bot-keys.util';
import type { AllowedOrigin } from './origin-validation.util';
import { normalizeVisitorMultiChatMax } from './visitor-multi-chat.util';
import { WorkspacesService } from '../workspaces/workspaces.service';
import type { WorkspaceBotPatchNormalized } from '../workspace/shared/bot-payload';
import { buildCustomerEmbedSnippet } from '../workspace/shared/customer-embed-snippet.util';
import type { BotLifecycleAction } from '../workspace/shared/bot-lifecycle-action.dto';
import { type ExampleQuestionDoc, exampleQuestionsToPublicLabels } from '../workspace/shared/example-questions.util';

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'bot';
}

function getCreatorDefaultsForUserFlow(createdByUserId?: Types.ObjectId) {
  return {
    visibility: 'public' as const,
    accessKey: generateBotAccessKey(),
    secretKey: generateBotSecretKey(),
    ...(createdByUserId ? { ownerId: createdByUserId } : {}),
  };
}

function hasActiveAllowedOrigin(allowedOrigins: AllowedOrigin[] | undefined): boolean {
  return (allowedOrigins ?? []).some((o) => o?.isActive !== false && String(o?.origin ?? '').trim().length > 0);
}

/** Safe KB metadata for marketing gallery (no signed URLs or storage keys; optional public download id). */
export type PublicKnowledgeBasePreviewItem = {
  title: string;
  sourceType: string;
  fileName?: string;
  fileType?: string;
  /** Mongo document id when `GET .../documents/:id/download` is supported for this row. */
  documentId?: string;
  fileDownloadable?: boolean;
};

/** Ready, active knowledge items only — counts for public gallery cards. */
export type PublicKnowledgeBaseCounts = {
  documents: number;
  faqs: number;
  notes: number;
  urls: number;
  html: number;
  datasheets: number;
};

export interface PublicBotDto {
  id: string;
  name: string;
  slug: string;
  visibility: 'public';
  accessKey: string;
  shortDescription?: string;
  category?: string;
  avatarEmoji?: string;
  imageUrl?: string;
  exampleQuestions: string[];
  chatUI?: {
    primaryColor?: string;
    backgroundStyle?: string;
    bubbleBorderRadius?: number;
    launcherPosition?: string;
    showBranding?: boolean;
    timePosition?: 'top' | 'bottom';
    showSources?: boolean;
    showCopyButton?: boolean;
    showMenuQuickLinks?: boolean;
    launcherAvatarUrl?: string;
  };
  createdAt: string;
  /** Ready knowledge items for gallery cards (capped per bot). */
  knowledgeBasePreview: PublicKnowledgeBasePreviewItem[];
  /** Counts of ready, active items by source type (gallery transparency). */
  knowledgeBaseCounts: PublicKnowledgeBaseCounts;
  /** Conversation count for gallery social proof (0 when none). */
  totalChats?: number;
  /** Active KB note body (trimmed, capped) for gallery — from `KnowledgeBaseItem` sourceType `note`. */
  knowledgeNotePreview?: string;
}

export interface ShowcaseAccessSettingsInput {
  visibility: 'public' | 'private';
  visitorMultiChatEnabled?: boolean;
  visitorMultiChatMax?: number | null;
}

/** Mongo collection for {@link Bot}; used in KB aggregations to scope rows to public showcase bots only. */
const BOTS_COLLECTION = 'bots';

/** Max characters of note `content` exposed on public list (gallery cards). */
const KNOWLEDGE_NOTE_PREVIEW_MAX = 800;

@Injectable()
export class BotsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(DocumentModel.name) private readonly documentModel: Model<DocumentModel>,
    @InjectModel(KnowledgeBaseItem.name) private readonly knowledgeBaseItemModel: Model<KnowledgeBaseItem>,
    @InjectModel(KnowledgeBaseChunk.name) private readonly knowledgeBaseChunkModel: Model<KnowledgeBaseChunk>,
    @InjectModel(IngestJob.name) private readonly ingestJobModel: Model<IngestJob>,
    @InjectModel(SummaryJob.name) private readonly summaryJobModel: Model<SummaryJob>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(VisitorEvent.name) private readonly visitorEventModel: Model<VisitorEvent>,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
    private readonly workspacesService: WorkspacesService,
  ) { }

  private async superadminUserObjectIds(): Promise<Types.ObjectId[]> {
    const rows = await this.userModel.find({ role: 'superadmin' }).select('_id').lean();
    return (rows as { _id: Types.ObjectId }[]).map((r) => r._id).filter(Boolean);
  }

  /** Published public gallery bots owned by a platform superadmin (`ownerId`). */
  private async publicShowcaseMongoFilter(): Promise<Record<string, unknown>> {
    const superIds = await this.superadminUserObjectIds();
    return {
      isPublic: true,
      status: 'published',
      visibility: 'public',
      ownerId: { $in: superIds },
    };
  }

  async findAll() {
    return this.botModel.find().select('-secretKey').lean();
  }

  /** Count agents-pack bots created by this platform user (pack generation cap). */
  async countAgentsPackBotsForCreator(userId: string): Promise<number> {
    if (!Types.ObjectId.isValid(userId)) return 0;
    return this.botModel.countDocuments({
      agentsPackAgent: true,
      createdByUserId: new Types.ObjectId(userId),
    });
  }

  /** Primary accent colors already used by this user's pack-generated bots (for unique pack colors). */
  async listShowcasePrimaryColorsForCreator(userId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const rows = await this.botModel
      .find({
        agentsPackAgent: true,
        createdByUserId: new Types.ObjectId(userId),
      })
      .select('chatUI.primaryColor')
      .lean();
    const out: string[] = [];
    for (const r of rows) {
      const c = (r as { chatUI?: { primaryColor?: string } }).chatUI?.primaryColor;
      if (typeof c === 'string' && c.trim()) out.push(c.trim());
    }
    return out;
  }

  /** Display names of pack-generated bots by this creator (for unique pack names). */
  async listShowcaseNamesForCreator(userId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const rows = await this.botModel
      .find({
        agentsPackAgent: true,
        createdByUserId: new Types.ObjectId(userId),
      })
      .select('name')
      .lean();
    const out: string[] = [];
    for (const r of rows) {
      const n = (r as { name?: string }).name;
      if (typeof n === 'string' && n.trim()) out.push(n.trim());
    }
    return out;
  }

  /** Lookup showcase bot by client draft id (for access checks before finalize). */
  async findWorkspaceByClientDraftId(clientDraftId: string): Promise<Record<string, unknown> | null> {
    const trimmed = clientDraftId?.trim();
    if (!trimmed) return null;
    const b = await this.botModel.findOne({ clientDraftId: trimmed }).lean();
    return b ? (b as Record<string, unknown>) : null;
  }

  /**
   * List bots for user panel with optional status filter.
   * `superadmin` sees all bots; `customer` sees bots in their workspaces or owner/created bots without workspaceId.
   */
  async findForAdminList(
    status?: 'draft' | 'published' | 'all',
    access?: { userId: string; platformRole: string; workspaceIds: Types.ObjectId[] },
  ) {
    const base: Record<string, unknown> = {};
    if (status && status !== 'all') base.status = status;

    if (!access || access.platformRole === 'superadmin') {
      return this.botModel
        .find(base)
        .sort({ createdAt: -1 })
        .select(
          'name agentsPackAgent category status isPublic createdAt _id slug visibility workspaceId chatUI avatarEmoji imageUrl shortDescription allowedOrigins leadCapture',
        )
        .lean();
    }

    const userOid = new Types.ObjectId(access.userId);
    const orClause: Record<string, unknown>[] = [];
    if (access.workspaceIds.length > 0) {
      orClause.push({ workspaceId: { $in: access.workspaceIds } });
    }
    orClause.push({
      $and: [
        { $or: [{ workspaceId: { $exists: false } }, { workspaceId: null }] },
        { $or: [{ ownerId: userOid }, { createdByUserId: userOid }] },
      ],
    });

    return this.botModel
      .find({ ...base, $or: orClause })
      .sort({ createdAt: -1 })
      .select(
        'name agentsPackAgent category status isPublic createdAt _id slug visibility workspaceId chatUI avatarEmoji imageUrl shortDescription allowedOrigins leadCapture',
      )
      .lean();
  }

  /**
   * Batch-fetch lightweight stats for a set of bots (used on the list/card view).
   * Runs five parallel aggregations: conversations, messages, KB items by sourceType, last activity, last trained.
   */
  async getListStatsForBots(
    botIds: string[],
  ): Promise<
    Map<
      string,
      {
        totalConversations: number;
        totalMessages: number;
        knowledgeDocs: number;
        knowledgeFaqs: number;
        knowledgeSnippets: number;
        knowledgeDatasheets: number;
        lastActivityAt: string | null;
        lastTrainedAt: string | null;
      }
    >
  > {
    const result = new Map<
      string,
      {
        totalConversations: number;
        totalMessages: number;
        knowledgeDocs: number;
        knowledgeFaqs: number;
        knowledgeSnippets: number;
        knowledgeDatasheets: number;
        lastActivityAt: string | null;
        lastTrainedAt: string | null;
      }
    >();
    if (botIds.length === 0) return result;

    const oids = botIds.map((id) => new Types.ObjectId(id));
    for (const id of botIds) {
      result.set(id, {
        totalConversations: 0,
        totalMessages: 0,
        knowledgeDocs: 0,
        knowledgeFaqs: 0,
        knowledgeSnippets: 0,
        knowledgeDatasheets: 0,
        lastActivityAt: null,
        lastTrainedAt: null,
      });
    }

    type CountRow = { _id: Types.ObjectId; n: number };
    type KBRow = { _id: { b: Types.ObjectId; t: string }; n: number };
    type DateRow = { _id: Types.ObjectId; lastAt: Date | null };

    const [convAgg, msgAgg, kbAgg, activityAgg, trainedAgg] = await Promise.all([
      this.conversationModel.aggregate<CountRow>([
        { $match: { botId: { $in: oids } } },
        { $group: { _id: '$botId', n: { $sum: 1 } } },
      ]),
      this.messageModel.aggregate<CountRow>([
        { $match: { botId: { $in: oids } } },
        { $group: { _id: '$botId', n: { $sum: 1 } } },
      ]),
      this.knowledgeBaseItemModel.aggregate<KBRow>([
        { $match: { botId: { $in: oids }, active: true, sourceType: { $in: ['document', 'faq', 'note', 'table'] } } },
        { $group: { _id: { b: '$botId', t: '$sourceType' }, n: { $sum: 1 } } },
      ]),
      this.conversationModel.aggregate<DateRow>([
        { $match: { botId: { $in: oids } } },
        { $group: { _id: '$botId', lastAt: { $max: { $ifNull: ['$lastActivityAt', '$createdAt'] } } } },
      ]),
      this.documentModel.aggregate<DateRow>([
        { $match: { botId: { $in: oids }, status: 'ready' } },
        { $group: { _id: '$botId', lastAt: { $max: { $ifNull: ['$ingestedAt', '$createdAt'] } } } },
      ]),
    ]);

    for (const r of convAgg) {
      const s = result.get(String(r._id));
      if (s) s.totalConversations = r.n;
    }
    for (const r of msgAgg) {
      const s = result.get(String(r._id));
      if (s) s.totalMessages = r.n;
    }
    for (const r of kbAgg) {
      const s = result.get(String(r._id));
      if (!s) continue;
      const t = String(r._id.t);
      if (t === 'document') s.knowledgeDocs = r.n;
      else if (t === 'faq') s.knowledgeFaqs = r.n;
      else if (t === 'note') s.knowledgeSnippets = r.n;
      else if (t === 'table') s.knowledgeDatasheets = r.n;
    }
    for (const r of activityAgg) {
      const s = result.get(String(r._id));
      if (s && r.lastAt) s.lastActivityAt = r.lastAt.toISOString();
    }
    for (const r of trainedAgg) {
      const s = result.get(String(r._id));
      if (s && r.lastAt) s.lastTrainedAt = r.lastAt.toISOString();
    }

    return result;
  }

  /**
   * Anonymous public gallery: published public bots **owned by a superadmin** (`ownerId`).
   */
  async findPublicShowcase(): Promise<PublicBotDto[]> {
    const match = await this.publicShowcaseMongoFilter();
    const docs = await this.botModel
      .find(match)
      .sort({ createdAt: -1 })
      .select(
        '_id name slug shortDescription category avatarEmoji imageUrl exampleQuestions chatUI createdAt visibility accessKey',
      )
      .lean();

    const bots = docs.map((bot: Record<string, unknown>) => ({
      id: String(bot._id),
      name: String(bot.name ?? ''),
      slug: String(bot.slug ?? ''),
      visibility: 'public' as const,
      accessKey: String(bot.accessKey ?? ''),
      shortDescription: bot.shortDescription != null ? String(bot.shortDescription) : undefined,
      category: bot.category != null ? String(bot.category) : undefined,
      avatarEmoji: bot.avatarEmoji != null ? String(bot.avatarEmoji) : undefined,
      imageUrl: bot.imageUrl != null ? String(bot.imageUrl) : undefined,
      exampleQuestions: exampleQuestionsToPublicLabels(bot.exampleQuestions),
      chatUI: bot.chatUI as PublicBotDto['chatUI'] | undefined,
      createdAt:
        bot.createdAt instanceof Date
          ? bot.createdAt.toISOString()
          : String(bot.createdAt ?? ''),
      knowledgeBasePreview: [] as PublicKnowledgeBasePreviewItem[],
      knowledgeBaseCounts: {
        documents: 0,
        faqs: 0,
        notes: 0,
        urls: 0,
        html: 0,
        datasheets: 0,
      },
    }));
    return this.attachTotalChats(
      await this.attachKnowledgeBaseCounts(
        await this.attachKnowledgeNotePreview(await this.attachKnowledgeBasePreview(bots)),
      ),
    );
  }

  /**
   * Same dataset as {@link findPublicShowcase} (superadmin-owned published public bots).
   * Used by the marketing landing app (API-key auth) and widget testing helpers.
   */
  async findPublicShowcaseBySuperAdminCreators(): Promise<PublicBotDto[]> {
    return this.findPublicShowcase();
  }

  /** Minimal id lookup for public document download (published, public, superadmin-owned). */
  async findPublicShowcaseBotIdBySlug(slug: string): Promise<string | null> {
    const match = await this.publicShowcaseMongoFilter();
    const doc = await this.botModel
      .findOne({
        slug: slug.trim().toLowerCase(),
        ...match,
      })
      .select('_id')
      .lean();
    return doc ? String((doc as { _id: unknown })._id) : null;
  }

  private async attachTotalChats(bots: PublicBotDto[]): Promise<PublicBotDto[]> {
    if (bots.length === 0) return bots;
    const botOids = bots.map((b) => new Types.ObjectId(b.id));
    const agg = await this.conversationModel.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { botId: { $in: botOids } } },
      { $group: { _id: '$botId', n: { $sum: 1 } } },
    ]);
    const byId = new Map<string, number>();
    for (const row of agg) {
      byId.set(String(row._id), row.n);
    }
    return bots.map((b) => ({ ...b, totalChats: byId.get(b.id) ?? 0 }));
  }

  private emptyKnowledgeBaseCounts(): PublicKnowledgeBaseCounts {
    return { documents: 0, faqs: 0, notes: 0, urls: 0, html: 0, datasheets: 0 };
  }

  /**
   * Counts ready, active knowledge rows per bot and sourceType (full totals, not preview-capped).
   * Only rows whose parent bot is **published**, **public**, and **isPublic** are included
   * (defense in depth for public gallery APIs).
   */
  private async attachKnowledgeBaseCounts(bots: PublicBotDto[]): Promise<PublicBotDto[]> {
    if (bots.length === 0) return bots;
    const botOids = bots.map((b) => new Types.ObjectId(b.id));
    type AggRow = { _id: { b: Types.ObjectId; t: string }; n: number };
    const agg = await this.knowledgeBaseItemModel.aggregate<AggRow>([
      {
        $match: {
          botId: { $in: botOids },
          active: true,
          status: 'ready',
          sourceType: { $in: ['document', 'faq', 'note', 'url', 'html', 'table'] },
        },
      },
      {
        $lookup: {
          from: BOTS_COLLECTION,
          let: { bid: '$botId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$bid'] } } },
            {
              $match: {
                isPublic: true,
                status: 'published',
                visibility: 'public',
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: '_showcaseBot',
        },
      },
      { $match: { _showcaseBot: { $ne: [] } } },
      { $group: { _id: { b: '$botId', t: '$sourceType' }, n: { $sum: 1 } } },
    ]);
    const byBot = new Map<string, PublicKnowledgeBaseCounts>();
    for (const b of bots) {
      byBot.set(b.id, this.emptyKnowledgeBaseCounts());
    }
    for (const row of agg) {
      const bid = String(row._id.b);
      const t = String(row._id.t ?? '');
      const n = typeof row.n === 'number' && row.n >= 0 ? row.n : 0;
      const cur = byBot.get(bid);
      if (!cur) continue;
      switch (t) {
        case 'document':
          cur.documents += n;
          break;
        case 'faq':
          cur.faqs += n;
          break;
        case 'note':
          cur.notes += n;
          break;
        case 'url':
          cur.urls += n;
          break;
        case 'html':
          cur.html += n;
          break;
        case 'table':
          cur.datasheets += n;
          break;
        default:
          break;
      }
    }
    return bots.map((b) => ({ ...b, knowledgeBaseCounts: byBot.get(b.id) ?? this.emptyKnowledgeBaseCounts() }));
  }

  /**
   * Loads a capped preview of ready, active knowledge items for gallery download hints.
   * Same **showcase-only** bot gate as {@link attachKnowledgeBaseCounts}.
   */
  private async attachKnowledgeBasePreview(bots: PublicBotDto[]): Promise<PublicBotDto[]> {
    if (bots.length === 0) return bots;
    const botIds = bots.map((b) => new Types.ObjectId(b.id));
    const KB_PREVIEW_PER_BOT = 6;
    const KB_QUERY_CAP = 500;

    type KbRow = {
      botId: Types.ObjectId;
      title?: string;
      sourceType?: string;
      sourceMeta?: unknown;
      documentId?: Types.ObjectId;
    };
    const rows = await this.knowledgeBaseItemModel.aggregate<KbRow>([
      {
        $match: {
          botId: { $in: botIds },
          active: true,
          status: 'ready',
          sourceType: { $in: ['document', 'faq', 'note', 'url', 'html', 'table'] },
        },
      },
      {
        $lookup: {
          from: BOTS_COLLECTION,
          let: { bid: '$botId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$bid'] } } },
            {
              $match: {
                isPublic: true,
                status: 'published',
                visibility: 'public',
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: '_showcaseBot',
        },
      },
      { $match: { _showcaseBot: { $ne: [] } } },
      { $sort: { createdAt: -1 } },
      { $limit: KB_QUERY_CAP },
      { $project: { botId: 1, title: 1, sourceType: 1, sourceMeta: 1, documentId: 1 } },
    ]);

    const docOidList = [
      ...new Set(
        rows
          .filter((r) => r.sourceType === 'document' && r.documentId)
          .map((r) => String(r.documentId)),
      ),
    ].filter((id) => Types.ObjectId.isValid(id));
    const docById = new Map<string, { botId: string; status?: string; active?: boolean; s3Bucket?: string; s3Key?: string; url?: string }>();
    if (docOidList.length > 0) {
      const docRows = await this.documentModel
        .find({ _id: { $in: docOidList.map((id) => new Types.ObjectId(id)) } })
        .select('botId status active s3Bucket s3Key url')
        .lean();
      for (const d of docRows) {
        const id = String((d as { _id: unknown })._id);
        const botId = String((d as { botId: Types.ObjectId }).botId);
        const row = d as { status?: string; active?: boolean; s3Bucket?: string; s3Key?: string; url?: string };
        docById.set(id, {
          botId,
          status: row.status,
          active: row.active,
          s3Bucket: typeof row.s3Bucket === 'string' ? row.s3Bucket : undefined,
          s3Key: typeof row.s3Key === 'string' ? row.s3Key : undefined,
          url: typeof row.url === 'string' ? row.url : undefined,
        });
      }
    }

    const isDocFileDownloadable = (d: { status?: string; active?: boolean; s3Bucket?: string; s3Key?: string; url?: string } | undefined): boolean => {
      if (!d || d.status !== 'ready' || d.active === false) return false;
      const b = (d.s3Bucket ?? '').trim();
      const k = (d.s3Key ?? '').trim();
      if (b && k) return true;
      const u = (d.url ?? '').trim();
      return /^https?:\/\//i.test(u);
    };

    const byBot = new Map<string, PublicKnowledgeBasePreviewItem[]>();
    for (const b of bots) {
      byBot.set(b.id, []);
    }

    for (const row of rows) {
      const bid = String(row.botId);
      const list = byBot.get(bid);
      if (!list || list.length >= KB_PREVIEW_PER_BOT) continue;

      const title = String(row.title ?? '').trim() || 'Untitled';
      const sourceType = String(row.sourceType ?? 'note');
      const meta = row.sourceMeta && typeof row.sourceMeta === 'object' ? row.sourceMeta : undefined;
      let fileName: string | undefined;
      let fileType: string | undefined;
      if (meta) {
        const fn = (meta as { fileName?: unknown }).fileName;
        const ft = (meta as { fileType?: unknown }).fileType;
        if (typeof fn === 'string' && fn.trim()) fileName = fn.trim();
        if (typeof ft === 'string' && ft.trim()) fileType = ft.trim();
      }

      const docId =
        sourceType === 'document' && row.documentId && Types.ObjectId.isValid(String(row.documentId))
          ? String(row.documentId)
          : undefined;
      const docMeta = docId ? docById.get(docId) : undefined;
      const downloadable =
        Boolean(docId) && Boolean(docMeta) && docMeta!.botId === bid && isDocFileDownloadable(docMeta);

      list.push({
        title,
        sourceType,
        ...(fileName ? { fileName } : {}),
        ...(fileType ? { fileType } : {}),
        ...(downloadable && docId ? { documentId: docId, fileDownloadable: true } : {}),
      });
    }

    return bots.map((b) => ({
      ...b,
      knowledgeBasePreview: byBot.get(b.id) ?? [],
    }));
  }

  /** Public gallery: attach trimmed note `content` per bot (parallel reads). */
  private async attachKnowledgeNotePreview(bots: PublicBotDto[]): Promise<PublicBotDto[]> {
    if (bots.length === 0) return bots;
    const contents = await Promise.all(
      bots.map((b) => this.knowledgeBaseItemService.getNoteContentForBot(b.id)),
    );
    return bots.map((b, i) => {
      const raw = (contents[i] ?? '').trim();
      if (!raw) return b;
      const knowledgeNotePreview =
        raw.length > KNOWLEDGE_NOTE_PREVIEW_MAX
          ? `${raw.slice(0, KNOWLEDGE_NOTE_PREVIEW_MAX).trimEnd()}…`
          : raw;
      return { ...b, knowledgeNotePreview };
    });
  }

  async findOne(id: string) {
    return this.botModel.findById(id).select('-secretKey').lean();
  }

  /** Check if a slug exists (any type). */
  async findOneBySlug(slug: string) {
    return this.botModel.findOne({ slug: slug.trim().toLowerCase() }).select('_id').lean();
  }

  /** Find published public bot by slug for marketing pages (returns BotLike shape; faqs and knowledgeDescription from KB). */
  async findOneBySlugForChat(slug: string) {
    const bot = await this.botModel
      .findOne({
        slug: slug.trim().toLowerCase(),
        isPublic: true,
        status: 'published',
        visibility: 'public',
      })
      .select('_id slug name shortDescription description category openaiApiKeyOverride welcomeMessage leadCapture personality config limitOverrideMessages includeNameInKnowledge includeTaglineInKnowledge')
      .lean();
    if (!bot) return null;
    const [faqs, knowledgeDescription] = await Promise.all([
      this.knowledgeBaseItemService.getFaqsForBot(String((bot as { _id: unknown })._id)),
      this.knowledgeBaseItemService.getNoteContentForBot(String((bot as { _id: unknown })._id)),
    ]);
    return { ...bot, faqs, knowledgeDescription } as Record<string, unknown>;
  }

  /**
   * Public embed widget bootstrap: published + public (any owner). Stricter than the marketing gallery
   * ({@link findPublicShowcase}), which is limited to superadmin-owned bots.
   */
  async findOneForPublicWidgetById(botId: string): Promise<{
    id: string;
    name: string;
    shortDescription?: string;
    description?: string;
    avatarEmoji?: string;
    imageUrl?: string;
    welcomeMessage?: string;
    chatUI: Record<string, unknown>;
    exampleQuestions: string[];
  } | null> {
    const id = botId?.trim();
    if (!id || !Types.ObjectId.isValid(id)) return null;
    const doc = await this.botModel
      .findOne({
        _id: new Types.ObjectId(id),
        isPublic: true,
        status: 'published',
        visibility: 'public',
      })
      .select('_id name shortDescription description avatarEmoji imageUrl welcomeMessage chatUI exampleQuestions')
      .lean();
    if (!doc) return null;
    const b = doc as Record<string, unknown>;
    const welcomeMsg =
      typeof b.welcomeMessage === 'string' && b.welcomeMessage.trim() ? b.welcomeMessage.trim() : undefined;
    return {
      id: String(b._id),
      name: String(b.name ?? ''),
      shortDescription:
        b.shortDescription != null && String(b.shortDescription).trim()
          ? String(b.shortDescription).trim()
          : undefined,
      description:
        b.description != null && String(b.description).trim() ? String(b.description).trim() : undefined,
      avatarEmoji: b.avatarEmoji != null ? String(b.avatarEmoji) : undefined,
      imageUrl: b.imageUrl != null ? String(b.imageUrl) : undefined,
      welcomeMessage: welcomeMsg,
      chatUI: (b.chatUI && typeof b.chatUI === 'object' ? b.chatUI : {}) as Record<string, unknown>,
      exampleQuestions: exampleQuestionsToPublicLabels(b.exampleQuestions),
    };
  }

  /** External runtime bot lookup (widget init/chat): includes access/policy fields. */
  async findOneByIdForExternalRuntime(botId: string): Promise<Record<string, unknown> | null> {
    const id = botId?.trim();
    if (!id || !Types.ObjectId.isValid(id)) return null;
    const bot = await this.botModel
      .findById(new Types.ObjectId(id))
           .select(
        '_id slug name shortDescription description category avatarEmoji imageUrl openaiApiKeyOverride welcomeMessage leadCapture personality config chatUI status isPublic visibility accessKey secretKey ownerId createdByUserId includeNameInKnowledge includeTaglineInKnowledge exampleQuestions allowedOrigins visitorMultiChatEnabled visitorMultiChatMax agentsPackAgent',
      )
      .lean();
    if (!bot) return null;
    const [faqs, knowledgeDescription] = await Promise.all([
      this.knowledgeBaseItemService.getFaqsForBot(String((bot as { _id: unknown })._id)),
      this.knowledgeBaseItemService.getNoteContentForBot(String((bot as { _id: unknown })._id)),
    ]);
    return { ...bot, faqs, knowledgeDescription } as Record<string, unknown>;
  }

  /** Find one bot by slug for marketing page (public shape; faqs from KB). Superadmin-owned gallery bots only. */
  async findOneBySlugForPage(slug: string): Promise<{
    id: string;
    slug: string;
    name: string;
    visibility: 'public';
    accessKey: string;
    shortDescription: string;
    description?: string;
    category?: string;
    avatarEmoji: string;
    imageUrl: string;
    welcomeMessage?: string;
    chatUI?: unknown;
    faqs: Array<{ question: string; answer: string }>;
    exampleQuestions: string[];
  } | null> {
    const match = await this.publicShowcaseMongoFilter();
    const doc = await this.botModel
      .findOne({
        slug: slug.trim().toLowerCase(),
        ...match,
      })
      .select(
        '_id slug name shortDescription description category avatarEmoji imageUrl welcomeMessage chatUI exampleQuestions visibility accessKey',
      )
      .lean();
    if (!doc) return null;
    const b = doc as Record<string, unknown>;
    const botId = String(b._id);
    const faqs = await this.knowledgeBaseItemService.getFaqsForBot(botId);
    const welcomeMsg = typeof b.welcomeMessage === 'string' && b.welcomeMessage.trim() ? b.welcomeMessage.trim() : undefined;
    const descRaw = b.description;
    const catRaw = b.category;
    return {
      id: botId,
      slug: String(b.slug ?? ''),
      name: String(b.name ?? ''),
      visibility: 'public',
      accessKey: String(b.accessKey ?? ''),
      shortDescription: String(b.shortDescription ?? ''),
      ...(typeof descRaw === 'string' && descRaw.trim()
        ? { description: descRaw.trim() }
        : {}),
      ...(typeof catRaw === 'string' && catRaw.trim() ? { category: catRaw.trim() } : {}),
      avatarEmoji: String(b.avatarEmoji ?? '💬'),
      imageUrl: String(b.imageUrl ?? ''),
      welcomeMessage: welcomeMsg,
      chatUI: b.chatUI as unknown,
      faqs,
      exampleQuestions: exampleQuestionsToPublicLabels(b.exampleQuestions),
    };
  }

  /** Find bot by id, for ownership check. */
  async findOneForOwnership(id: string) {
    return this.botModel
      .findById(id)
      .select('_id ownerId')
      .lean();
  }

  /** Generate unique slug; optionally exclude a bot id from collision check. */
  async generateUniqueSlug(base: string, excludeBotId?: string): Promise<string> {
    const normalized = slugify(base);
    const query = excludeBotId
      ? { slug: normalized, _id: { $ne: excludeBotId } }
      : { slug: normalized };
    const existing = await this.botModel.findOne(query).select('_id').lean();
    if (!existing) return normalized;
    for (let attempt = 2; attempt <= 50; attempt++) {
      const candidate = `${normalized}-${attempt}`;
      const q = excludeBotId ? { slug: candidate, _id: { $ne: excludeBotId } } : { slug: candidate };
      const collides = await this.botModel.findOne(q).select('_id').lean();
      if (!collides) return candidate;
    }
    return `${normalized}-${Date.now()}`;
  }

  /** Workspace bot for admin GET (faqs, snippets, tables, knowledgeDescription from KB). */
  async findOneWorkspaceForAdmin(id: string) {
    const bot = await this.botModel
      .findById(id)
      .select('slug name shortDescription description category categories imageUrl avatarEmoji openaiApiKeyOverride whisperApiKeyOverride welcomeMessage welcomeMessageEnabled status isPublic leadCapture chatUI exampleQuestions personality config limitOverrideMessages visibility accessKey secretKey ownerId visitorMultiChatEnabled visitorMultiChatMax includeNameInKnowledge includeTaglineInKnowledge includeNotesInKnowledge allowedOrigins workspaceId agentsPackAgent')
      .lean();
    if (!bot) return null;
    const [faqs, knowledgeSnippets, knowledgeDatasheets, knowledgeDescription] = await Promise.all([
      this.knowledgeBaseItemService.getFaqsForBot(id, { includeInactive: true }),
      this.knowledgeBaseItemService.getSnippetsForBot(id, { includeInactive: true }),
      this.knowledgeBaseItemService.getTablesForBot(id, { includeInactive: true }),
      this.knowledgeBaseItemService.getNoteContentForBot(id),
    ]);
    return { ...bot, faqs, knowledgeSnippets, knowledgeDatasheets, knowledgeDescription } as Record<string, unknown>;
  }

  async create(data: Record<string, unknown>) {
    const doc = await this.botModel.create(data);
    return doc.toObject();
  }

  async updateWorkspaceAccessSettings(
    id: string,
    input: ShowcaseAccessSettingsInput,
  ): Promise<{
    ok: true;
    botId: string;
    visibility: 'public' | 'private';
    accessKey: string;
    secretKey: string;
    visitorMultiChatEnabled: boolean;
    visitorMultiChatMax: number | null;
  }> {
    const existing = await this.botModel
      .findById(id)
      .select('_id visibility accessKey secretKey')
      .lean();
    if (!existing) {
      throw new Error('Bot not found');
    }
    const visibility = input.visibility === 'private' ? 'private' : 'public';

    const visitorMultiChatEnabled = input.visitorMultiChatEnabled === true;
    const rawVisitorMax = input.visitorMultiChatMax;
    const visitorMultiChatMax =
      !visitorMultiChatEnabled
        ? null
        : rawVisitorMax === null || rawVisitorMax === undefined
          ? null
          : normalizeVisitorMultiChatMax(rawVisitorMax);

    const updated = await this.botModel
      .findByIdAndUpdate(
        id,
        {
          visibility,
          visitorMultiChatEnabled,
          visitorMultiChatMax,
        },
        { new: true },
      )
      .select('_id visibility accessKey secretKey visitorMultiChatEnabled visitorMultiChatMax')
      .lean();
    if (!updated) throw new Error('Bot not found');
    const bot = updated as Record<string, unknown>;
    return {
      ok: true,
      botId: String(bot._id),
      visibility: bot.visibility === 'private' ? 'private' : 'public',
      accessKey: String(bot.accessKey ?? ''),
      secretKey: String(bot.secretKey ?? ''),
      visitorMultiChatEnabled: (bot as { visitorMultiChatEnabled?: boolean }).visitorMultiChatEnabled === true,
      visitorMultiChatMax: normalizeVisitorMultiChatMax((bot as { visitorMultiChatMax?: unknown }).visitorMultiChatMax),
    };
  }

  async rotateWorkspaceAccessKey(id: string): Promise<{ ok: true; botId: string; accessKey: string }> {
    const updated = await this.botModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id) },
        { accessKey: generateBotAccessKey() },
        { new: true },
      )
      .select('_id accessKey')
      .lean();
    if (!updated) throw new Error('Bot not found');
    return { ok: true, botId: String((updated as { _id: unknown })._id), accessKey: String((updated as { accessKey?: unknown }).accessKey ?? '') };
  }

  async rotateWorkspaceSecretKey(id: string): Promise<{ ok: true; botId: string; secretKey: string }> {
    const updated = await this.botModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id) },
        { secretKey: generateBotSecretKey() },
        { new: true },
      )
      .select('_id secretKey')
      .lean();
    if (!updated) throw new Error('Bot not found');
    return { ok: true, botId: String((updated as { _id: unknown })._id), secretKey: String((updated as { secretKey?: unknown }).secretKey ?? '') };
  }

  async createDraft(
    clientDraftId: string,
    createdByUserId?: string,
  ): Promise<{ botId: string; slug: string }> {
    const existing = await this.botModel
      .findOne({ clientDraftId, status: 'draft' })
      .select('_id slug')
      .lean();
    if (existing) {
      return { botId: String((existing as { _id: unknown })._id), slug: (existing as { slug: string }).slug };
    }
    const creatorOid =
      createdByUserId && Types.ObjectId.isValid(createdByUserId)
        ? new Types.ObjectId(createdByUserId)
        : undefined;
    let workspaceOid: Types.ObjectId | undefined;
    if (creatorOid) {
      workspaceOid = await this.workspacesService.ensurePersonalWorkspaceForUser(String(creatorOid));
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = await this.generateUniqueSlug('ai-support-assistant');
      try {
        const payload = getDefaultBotCreatePayload(slug, clientDraftId);
        const created = await this.botModel.create({
          ...(payload as unknown as Record<string, unknown>),
          ...getCreatorDefaultsForUserFlow(creatorOid),
          ...(creatorOid ? { createdByUserId: creatorOid } : {}),
          ...(workspaceOid ? { workspaceId: workspaceOid } : {}),
        });
        return { botId: String((created as { _id: unknown })._id), slug: (created as { slug: string }).slug };
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (e.code === 11000 && e.keyPattern?.clientDraftId) {
          const dup = await this.botModel.findOne({ clientDraftId, status: 'draft' }).select('_id slug').lean();
          if (dup) return { botId: String((dup as { _id: unknown })._id), slug: (dup as { slug: string }).slug };
        }
        if (!(e.code === 11000 && (e.keyPattern?.slug || e.keyPattern?.accessKey))) throw err;
      }
    }
    throw new Error('Failed to allocate unique slug.');
  }

  async finalizeDraft(
    clientDraftId: string,
    normalized: {
      name: string;
      shortDescription?: string;
      description?: string;
      categories: string[];
      imageUrl?: string;
      openaiApiKeyOverride?: string;
      whisperApiKeyOverride?: string;
      welcomeMessage?: string;
      welcomeMessageEnabled?: boolean;
      knowledgeDescription?: string;
      leadCapture?: unknown;
      chatUI?: unknown;
      faqs?: unknown;
      exampleQuestions?: ExampleQuestionDoc[];
      personality?: unknown;
      config?: unknown;
      limitOverrideMessages?: number;
      isPublic: boolean;
      includeNameInKnowledge?: boolean;
      includeTaglineInKnowledge?: boolean;
      includeNotesInKnowledge: boolean;
      visibility?: 'public' | 'private';
      allowedOrigins?: AllowedOrigin[];
    },
    createdByUserId?: string,
  ): Promise<{ botId: string; slug: string }> {
    const finalName = normalized.name || 'Draft bot';
    const finalDescription = normalized.description || '';
    if (!hasActiveAllowedOrigin(normalized.allowedOrigins)) {
      throw new Error('At least one active allowed embed origin is required to publish.');
    }
    const creatorOid =
      createdByUserId && Types.ObjectId.isValid(createdByUserId)
        ? new Types.ObjectId(createdByUserId)
        : undefined;
    const existing = await this.botModel
      .findOne({ clientDraftId })
      .select('_id slug name createdAt createdByUserId accessKey secretKey ownerId visibility workspaceId')
      .lean();
    if (existing) {
      let finalSlug = (existing as { slug: string }).slug;
      const shouldUpdateSlug = finalName !== String((existing as { name?: string }).name ?? '');
      if (!finalSlug || shouldUpdateSlug) {
        finalSlug = await this.generateUniqueSlug(finalName || 'draft-bot', String((existing as { _id: unknown })._id));
      }
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const setCreatedBy =
            creatorOid && !(existing as { createdByUserId?: unknown }).createdByUserId
              ? { createdByUserId: creatorOid }
              : {};
          const existingWs = (existing as { workspaceId?: Types.ObjectId }).workspaceId;
          const workspaceIdResolved =
            existingWs ??
            (creatorOid ? await this.workspacesService.ensurePersonalWorkspaceForUser(String(creatorOid)) : undefined);
          await this.botModel.updateOne(
            { _id: (existing as { _id: unknown })._id },
            {
              name: finalName,
              slug: finalSlug,
              shortDescription: normalized.shortDescription,
              description: finalDescription,
              categories: normalized.categories,
              category: normalized.categories?.[0],
              imageUrl: normalized.imageUrl,
              openaiApiKeyOverride: normalized.openaiApiKeyOverride,
              whisperApiKeyOverride: normalized.whisperApiKeyOverride,
              welcomeMessage: normalized.welcomeMessage,
              welcomeMessageEnabled:
                normalized.welcomeMessageEnabled !== undefined
                  ? normalized.welcomeMessageEnabled
                  : Boolean(normalized.welcomeMessage),
              leadCapture: normalized.leadCapture,
              chatUI: normalized.chatUI,
              exampleQuestions: normalized.exampleQuestions ?? [],
              personality: normalized.personality,
              config: normalized.config,
              limitOverrideMessages: normalized.limitOverrideMessages,
              status: 'published',
              clientDraftId: undefined,
              isPublic: normalized.isPublic,
              includeNameInKnowledge: normalized.includeNameInKnowledge,
              includeTaglineInKnowledge: normalized.includeTaglineInKnowledge,
              includeNotesInKnowledge: normalized.includeNotesInKnowledge,
              ownerId: (existing as { ownerId?: unknown }).ownerId ?? creatorOid ?? undefined,
              visibility: normalized.visibility ?? (existing as { visibility?: 'public' | 'private' }).visibility ?? 'public',
              accessKey: (existing as { accessKey?: string }).accessKey || generateBotAccessKey(),
              secretKey: (existing as { secretKey?: string }).secretKey || generateBotSecretKey(),
              ...(normalized.allowedOrigins !== undefined ? { allowedOrigins: normalized.allowedOrigins } : {}),
              ...(workspaceIdResolved ? { workspaceId: workspaceIdResolved } : {}),
              ...setCreatedBy,
            },
          );
          const botIdStr = String((existing as { _id: unknown })._id);
          const finalFaqs = Array.isArray(normalized.faqs) ? normalized.faqs : [];
          const norm = normalized as unknown as Record<string, unknown>;
          const finalSnippets = Array.isArray(norm.knowledgeSnippets)
            ? (norm.knowledgeSnippets as Array<{ title: string; snippet: string; active?: boolean }>)
            : [];
          const finalTables = Array.isArray(norm.knowledgeDatasheets ?? norm.knowledgeTables)
            ? ((norm.knowledgeDatasheets ?? norm.knowledgeTables) as Array<{
                title: string;
                columns: string[];
                rows: string[][];
                active?: boolean;
              }>)
            : [];
          const finalNote = String(normalized.knowledgeDescription ?? '').trim();
          await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botIdStr, finalFaqs);
          if (finalSnippets.length > 0) {
            await this.knowledgeBaseItemService.upsertSnippetKnowledgeItemsForBot(botIdStr, finalSnippets);
          } else {
            await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(botIdStr, finalNote);
          }
          if (finalTables.length > 0) {
            await this.knowledgeBaseItemService.upsertTableKnowledgeItemsForBot(botIdStr, finalTables);
          }
          await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(botIdStr);
          await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(botIdStr);
          if (finalTables.length > 0) {
            await this.knowledgeBaseChunkService.replaceTableKnowledgeChunksForBot(botIdStr);
          }
          return { botId: botIdStr, slug: finalSlug };
        } catch (err: unknown) {
          const e = err as { code?: number; keyPattern?: Record<string, number> };
          if (!(e.code === 11000 && (e.keyPattern?.slug || e.keyPattern?.accessKey))) throw err;
          finalSlug = await this.generateUniqueSlug(finalName || 'draft-bot', String((existing as { _id: unknown })._id));
        }
      }
      throw new Error('Failed to allocate unique slug.');
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = await this.generateUniqueSlug(finalName || 'draft-bot');
      try {
        const wsForCreate =
          creatorOid ? await this.workspacesService.ensurePersonalWorkspaceForUser(String(creatorOid)) : undefined;
        const created = await this.botModel.create({
          name: finalName,
          slug,
          shortDescription: normalized.shortDescription,
          description: finalDescription,
          categories: normalized.categories,
          category: normalized.categories?.[0],
          imageUrl: normalized.imageUrl,
          openaiApiKeyOverride: normalized.openaiApiKeyOverride,
          whisperApiKeyOverride: normalized.whisperApiKeyOverride,
          welcomeMessage: normalized.welcomeMessage,
          welcomeMessageEnabled:
            normalized.welcomeMessageEnabled !== undefined
              ? normalized.welcomeMessageEnabled
              : Boolean(normalized.welcomeMessage),
          leadCapture: normalized.leadCapture,
          chatUI: normalized.chatUI,
          exampleQuestions: normalized.exampleQuestions ?? [],
          personality: normalized.personality,
          config: normalized.config,
          limitOverrideMessages: normalized.limitOverrideMessages,
          widgetEmbedRateLimitPerMinute: DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE,
          status: 'published',
          isPublic: normalized.isPublic,
          includeNameInKnowledge: normalized.includeNameInKnowledge,
          includeTaglineInKnowledge: normalized.includeTaglineInKnowledge,
          includeNotesInKnowledge: normalized.includeNotesInKnowledge,
          ...getCreatorDefaultsForUserFlow(creatorOid),
          ...(normalized.visibility ? { visibility: normalized.visibility } : {}),
          ...(normalized.allowedOrigins !== undefined ? { allowedOrigins: normalized.allowedOrigins } : {}),
          ...(wsForCreate ? { workspaceId: wsForCreate } : {}),
          createdAt: new Date(),
          ...(creatorOid ? { createdByUserId: creatorOid } : {}),
        });
        const botIdStr = String((created as { _id: unknown })._id);
        const finalFaqs = Array.isArray(normalized.faqs) ? normalized.faqs : [];
        const nrm = normalized as unknown as Record<string, unknown>;
        const finalSnippets = Array.isArray(nrm.knowledgeSnippets)
          ? (nrm.knowledgeSnippets as Array<{ title: string; snippet: string; active?: boolean }>)
          : [];
        const finalTables = Array.isArray(nrm.knowledgeDatasheets ?? nrm.knowledgeTables)
          ? ((nrm.knowledgeDatasheets ?? nrm.knowledgeTables) as Array<{
              title: string;
              columns: string[];
              rows: string[][];
              active?: boolean;
            }>)
          : [];
        const finalNote = String(normalized.knowledgeDescription ?? '').trim();
        await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botIdStr, finalFaqs);
        if (finalSnippets.length > 0) {
          await this.knowledgeBaseItemService.upsertSnippetKnowledgeItemsForBot(botIdStr, finalSnippets);
        } else {
          await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(botIdStr, finalNote);
        }
        if (finalTables.length > 0) {
          await this.knowledgeBaseItemService.upsertTableKnowledgeItemsForBot(botIdStr, finalTables);
        }
        await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(botIdStr);
        await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(botIdStr);
        if (finalTables.length > 0) {
          await this.knowledgeBaseChunkService.replaceTableKnowledgeChunksForBot(botIdStr);
        }
        return { botId: botIdStr, slug: (created as { slug: string }).slug };
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (!(e.code === 11000 && (e.keyPattern?.slug || e.keyPattern?.accessKey))) throw err;
      }
    }
    throw new Error('Failed to allocate unique slug.');
  }

  async updateWorkspaceBot(
    id: string,
    patch: WorkspaceBotPatchNormalized,
  ): Promise<{ ok: true; botId: string; status: string }> {
    const existingFull = await this.botModel.findById(id).lean();
    if (!existingFull) {
      throw new Error('Bot not found');
    }
    const ex = existingFull as Record<string, unknown>;

    if (patch.touched.size === 0) {
      const st = String(ex.status ?? '') === 'published' ? 'published' : 'draft';
      return { ok: true, botId: id, status: st };
    }

    const effectiveStatus: 'draft' | 'published' =
      patch.touched.has('status') && patch.status
        ? patch.status === 'published'
          ? 'published'
          : 'draft'
        : String(ex.status ?? '') === 'published'
          ? 'published'
          : 'draft';

    const effectiveName =
      patch.touched.has('name') ? (patch.name?.trim() || 'New bot') : String(ex.name ?? '').trim() || 'New bot';

    const effectiveDescription = patch.touched.has('description')
      ? String(patch.description ?? '').trim()
      : String(ex.description ?? '').trim();

    let mergedOriginsForPublish: AllowedOrigin[] = [];
    if (patch.touched.has('allowedOrigins')) {
      mergedOriginsForPublish = patch.allowedOrigins ?? [];
    } else if (Array.isArray(ex.allowedOrigins)) {
      mergedOriginsForPublish = ex.allowedOrigins as AllowedOrigin[];
    }

    if (effectiveStatus === 'published') {
      if (!effectiveName.trim()) throw new Error('Name is required to publish.');
      if (!effectiveDescription) throw new Error('Description is required to publish.');
      if (!hasActiveAllowedOrigin(mergedOriginsForPublish)) {
        throw new Error('At least one active allowed embed origin is required to publish.');
      }
    }

    const updateDoc: Record<string, unknown> = {};

    let nextSlug = String(ex.slug ?? '');
    let finalNameForSlug = String(ex.name ?? '').trim() || 'New bot';
    if (patch.touched.has('name')) {
      updateDoc.name = effectiveName;
      finalNameForSlug = patch.name!.trim() || 'New bot';
      const shouldUpdateSlug = finalNameForSlug !== String(ex.name ?? '').trim();
      if (shouldUpdateSlug) {
        nextSlug = await this.generateUniqueSlug(finalNameForSlug, id);
      }
      updateDoc.slug = nextSlug;
    }

    if (patch.touched.has('shortDescription')) {
      updateDoc.shortDescription = patch.shortDescription ?? '';
    }
    if (patch.touched.has('description')) {
      updateDoc.description = effectiveDescription;
    }
    if (patch.touched.has('categories')) {
      updateDoc.categories = patch.categories;
      updateDoc.category = patch.categories?.[0];
    }
    if (patch.touched.has('imageUrl')) {
      updateDoc.imageUrl = patch.imageUrl ?? '';
    }
    if (patch.touched.has('avatarEmoji')) {
      updateDoc.avatarEmoji = patch.avatarEmoji ?? '';
    }
    if (patch.touched.has('avatarSource')) {
      const a = patch.avatarSource;
      if (a === 'upload' || a === 'url' || a === 'emoji' || a === 'none') {
        updateDoc.avatarSource = a;
      }
    }
    if (patch.touched.has('welcomeMessage')) {
      updateDoc.welcomeMessage = patch.welcomeMessage ?? '';
    }
    if (patch.touched.has('welcomeMessageEnabled')) {
      updateDoc.welcomeMessageEnabled = patch.welcomeMessageEnabled === true;
    }
    if (patch.touched.has('exampleQuestions')) {
      updateDoc.exampleQuestions = patch.exampleQuestions ?? [];
    }
    if (patch.touched.has('leadCapture')) {
      updateDoc.leadCapture = patch.leadCapture;
    }
    if (patch.touched.has('chatUI')) {
      updateDoc.chatUI = patch.chatUI;
    }
    if (patch.touched.has('personality')) {
      /** Replace subdocument (same as pre-partial PATCH): sparse normalized object overwrites stored personality. */
      updateDoc.personality = patch.personality && typeof patch.personality === 'object' ? patch.personality : {};
    }
    if (patch.touched.has('config')) {
      updateDoc.config = patch.config && typeof patch.config === 'object' ? patch.config : {};
    }
    if (patch.touched.has('openaiApiKeyOverride')) {
      updateDoc.openaiApiKeyOverride = patch.openaiApiKeyOverride;
    }
    if (patch.touched.has('whisperApiKeyOverride')) {
      updateDoc.whisperApiKeyOverride = patch.whisperApiKeyOverride;
    }
    if (patch.touched.has('limitOverrideMessages')) {
      updateDoc.limitOverrideMessages = patch.limitOverrideMessages;
    }
    if (patch.touched.has('visibility') && patch.visibility) {
      updateDoc.visibility = patch.visibility;
    }
    if (patch.touched.has('isPublic')) {
      updateDoc.isPublic = patch.isPublic !== false;
    }
    if (patch.touched.has('status') && patch.status) {
      updateDoc.status = patch.status === 'published' ? 'published' : 'draft';
    }
    if (patch.touched.has('includeNameInKnowledge')) {
      updateDoc.includeNameInKnowledge = patch.includeNameInKnowledge === true;
    }
    if (patch.touched.has('includeTaglineInKnowledge')) {
      updateDoc.includeTaglineInKnowledge = patch.includeTaglineInKnowledge === true;
    }
    if (patch.touched.has('includeNotesInKnowledge')) {
      updateDoc.includeNotesInKnowledge = patch.includeNotesInKnowledge !== false;
    }
    if (patch.touched.has('allowedOrigins')) {
      updateDoc.allowedOrigins = patch.allowedOrigins ?? [];
    }
    if (patch.touched.has('visitorMultiChatEnabled')) {
      updateDoc.visitorMultiChatEnabled = patch.visitorMultiChatEnabled === true;
      updateDoc.visitorMultiChatMax =
        patch.visitorMultiChatEnabled === true ? patch.visitorMultiChatMax ?? null : null;
    }

    const faqTouched = patch.touched.has('faqs');
    const faqRowsForKb = faqTouched && Array.isArray(patch.faqs) ? patch.faqs : null;
    const snippetsTouched = patch.touched.has('knowledgeSnippets');
    const knowledgeSnippetsForKb = snippetsTouched && Array.isArray(patch.knowledgeSnippets) ? patch.knowledgeSnippets : null;
    const tablesTouched = patch.touched.has('knowledgeDatasheets') || patch.touched.has('knowledgeTables');
    const knowledgeDatasheetsForKb = tablesTouched && Array.isArray(patch.knowledgeDatasheets) ? patch.knowledgeDatasheets : null;
    const noteBodyForKb =
      patch.touched.has('knowledgeDescription') ? String(patch.knowledgeDescription ?? '').trim() : null;

    const outStatus =
      patch.touched.has('status') && patch.status
        ? patch.status === 'published'
          ? 'published'
          : 'draft'
        : String(ex.status ?? '') === 'published'
          ? 'published'
          : 'draft';

    const runKbSideEffects = async () => {
      if (faqTouched && faqRowsForKb) {
        await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(id, faqRowsForKb);
        await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(id);
      }
      if (snippetsTouched && knowledgeSnippetsForKb) {
        await this.knowledgeBaseItemService.upsertSnippetKnowledgeItemsForBot(id, knowledgeSnippetsForKb);
        await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(id);
      } else if (noteBodyForKb !== null) {
        await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(id, noteBodyForKb);
        await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(id);
      }
      if (tablesTouched && knowledgeDatasheetsForKb) {
        await this.knowledgeBaseItemService.upsertTableKnowledgeItemsForBot(id, knowledgeDatasheetsForKb);
        await this.knowledgeBaseChunkService.replaceTableKnowledgeChunksForBot(id);
      }
    };

    const mongoKeys = Object.keys(updateDoc);
    if (mongoKeys.length === 0) {
      await runKbSideEffects();
      return { ok: true, botId: id, status: outStatus };
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await this.botModel.findByIdAndUpdate(id, updateDoc);
        await runKbSideEffects();
        return { ok: true, botId: id, status: outStatus };
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (!(e.code === 11000 && e.keyPattern?.slug)) throw err;
        if (!patch.touched.has('name')) throw err;
        nextSlug = await this.generateUniqueSlug(finalNameForSlug, id);
        updateDoc.slug = nextSlug;
      }
    }
    throw new Error('Failed to allocate unique slug.');
  }

  private activeAllowedOriginSummary(ex: Record<string, unknown>): string[] {
    const raw = Array.isArray(ex.allowedOrigins) ? (ex.allowedOrigins as AllowedOrigin[]) : [];
    return raw
      .filter((o) => o?.isActive !== false && typeof o?.origin === 'string' && o.origin.trim() !== '')
      .map((o) => o.origin!.trim());
  }

  /** Same publish rules as `updateWorkspaceBot` when transitioning to published (name, description, active origins). */
  private assertExistingWorkspaceBotPublishableForLifecycle(ex: Record<string, unknown>): void {
    const effectiveName = String(ex.name ?? '').trim() || 'New bot';
    const effectiveDescription = String(ex.description ?? '').trim();
    const mergedOrigins = Array.isArray(ex.allowedOrigins) ? (ex.allowedOrigins as AllowedOrigin[]) : [];
    if (!effectiveName.trim()) throw new Error('Name is required to publish.');
    if (!effectiveDescription) throw new Error('Description is required to publish.');
    if (!hasActiveAllowedOrigin(mergedOrigins)) {
      throw new Error('At least one active allowed embed origin is required to publish.');
    }
  }

  /**
   * Dedicated customer lifecycle transition (not sparse PATCH). Validates then sets `status` only.
   */
  async customerBotLifecycleAction(
    id: string,
    action: BotLifecycleAction,
    opts: { publicApiBaseUrl: string; widgetAssetOrigin: string },
  ): Promise<
    | {
        ok: true;
        action: 'publish';
        status: 'published';
        embedSnippet: string;
        accessKey: string;
        allowedOrigins: string[];
      }
    | { ok: true; action: 'draft'; status: 'draft' }
  > {
    const existingFull = await this.botModel.findById(id).lean();
    if (!existingFull) {
      throw new Error('Bot not found');
    }
    const ex = existingFull as Record<string, unknown>;
    const currentStatus = String(ex.status ?? '') === 'published' ? 'published' : 'draft';

    if (action === 'draft') {
      if (currentStatus !== 'draft') {
        await this.botModel.updateOne({ _id: new Types.ObjectId(id) }, { $set: { status: 'draft' } });
      }
      return { ok: true, action: 'draft', status: 'draft' };
    }

    this.assertExistingWorkspaceBotPublishableForLifecycle(ex);
    if (currentStatus !== 'published') {
      await this.botModel.updateOne({ _id: new Types.ObjectId(id) }, { $set: { status: 'published' } });
    }

    const accessKey = typeof ex.accessKey === 'string' ? ex.accessKey : '';
    const visibility =
      ex.visibility === 'private' || ex.visibility === 'public' ? ex.visibility : 'public';
    const secretKey = typeof ex.secretKey === 'string' ? ex.secretKey : '';
    const embedSnippet = buildCustomerEmbedSnippet({
      botId: id,
      apiBaseUrl: opts.publicApiBaseUrl,
      accessKey,
      visibility,
      ...(visibility === 'private' && secretKey.trim() ? { secretKey: secretKey.trim() } : {}),
      widgetAssetOrigin: opts.widgetAssetOrigin,
    });

    return {
      ok: true,
      action: 'publish',
      status: 'published',
      embedSnippet,
      accessKey,
      allowedOrigins: this.activeAllowedOriginSummary(ex),
    };
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.botModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  }

  async remove(id: string) {
    const botOid = new Types.ObjectId(id);
    const session = await this.botModel.db.startSession();
    session.startTransaction();
    try {
      // Jobs / background pipelines
      await this.ingestJobModel.deleteMany({ botId: botOid }).session(session);
      await this.summaryJobModel.deleteMany({ botId: botOid }).session(session);

      // Chat data
      await this.messageModel.deleteMany({ botId: botOid }).session(session);
      await this.conversationModel.deleteMany({ botId: botOid }).session(session);
      await this.visitorEventModel.deleteMany({ botId: botOid }).session(session);

      // RAG / knowledge data
      await this.knowledgeBaseChunkModel.deleteMany({ botId: botOid }).session(session);
      await this.knowledgeBaseItemModel.deleteMany({ botId: botOid }).session(session);
      await this.documentModel.deleteMany({ botId: botOid }).session(session);

      // Finally remove the bot itself.
      await this.botModel.deleteOne({ _id: botOid }).session(session);

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
    return { deleted: id };
  }
}
