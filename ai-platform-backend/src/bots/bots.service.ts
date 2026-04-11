import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
import { getDefaultBotCreatePayload } from '../user/default-new-bot.payload';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { generateBotAccessKey, generateBotSecretKey } from './bot-keys.util';
import { normalizeUserWebsiteInputToHostname, parseAllowedDomainRulesFromStoredArray } from './embed-domain.util';
import {
  assertWebsiteURLAllowlistWritePolicy,
  assertTrialBotAllowedDomainsPolicy,
  normalizeWebsiteURLAllowlistRowPublic,
} from './platform-visitor-website-allowlist.util';
import { validateRuntimeBotAccess } from './runtime-bot-access.util';
import { normalizeVisitorMultiChatMax } from './visitor-multi-chat.util';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { VisitorsService } from '../visitors/visitors.service';
import type { TrialWorkspaceDraftV3Api } from '../visitors/trial-onboarding-draft-api.util';
import { resolveFinalAvatarUrlFromDraftRow } from '../visitors/trial-avatar-resolve.util';
import type { BotLeadCaptureV2 } from '../models/bot.schema';
import {
  buildCategoryBehaviorContext,
  buildDefaultTrialLeadCapture,
  buildTrialExampleQuestions,
  buildTrialVisitorChatUIPreset,
  buildTrialWelcomeMessage,
  coerceBehaviorPreset,
  isWeakAgentDescription,
  mapCategoryToBehaviorPreset,
  resolvePrimaryCategoryId,
} from './trial-bot-from-draft-defaults.util';
import {
  getTrialOnboardingUploadSessionId,
  listKnowledgeDocumentAssetsFromDraft,
  parseTrialOnboardingFaqsForKnowledgeBase,
} from './trial-onboarding-knowledge-bootstrap.util';
import {
  parseTrialWorkspaceBehaviorPatch,
  parseTrialWorkspaceKnowledgePatch,
  parseTrialWorkspaceProfilePatch,
} from './trial-workspace-agent.util';
import { DocumentsService } from '../documents/documents.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { getS3PublicBucketOrThrow } from '../lib/s3';

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
    creatorType: 'user' as const,
    visibility: 'public' as const,
    messageLimitMode: 'none' as const,
    messageLimitTotal: null as number | null,
    messageLimitUpgradeMessage: null as string | null,
    accessKey: generateBotAccessKey(),
    secretKey: generateBotSecretKey(),
    ...(createdByUserId ? { ownerUserId: createdByUserId } : {}),
  };
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
    showEmoji?: boolean;
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

export interface CreateVisitorTrialBotInput {
  platformVisitorId?: string;
  /** @deprecated legacy alias for platformVisitorId */
  visitorId?: string;
  /**
   * Required. Single hostname where the embedded widget is allowed (same limit as non–super-admin accounts).
   * Example: window.location.hostname from the page that creates the trial.
   */
  allowedDomain: string;
  /** Additional hostnames (normalized) merged into `allowedDomains` after the primary. */
  extraAllowedDomains?: string[];
  name?: string;
  welcomeMessage?: string;
  shortDescription?: string;
  description?: string;
  imageUrl?: string;
  avatarEmoji?: string;
  categories?: string[];
  /** Primary chat accent (hex), e.g. onboarding brand color. */
  brandColor?: string;
  /** Menu quick links (header); max 10. */
  menuQuickLinks?: Array<{ text: string; route: string; icon?: string }>;
  /** Combined behavior / identity instructions for the model. */
  personalitySystemPrompt?: string;
  personalityTone?: string;
  /** BotPersonality.behaviorPreset (schema enum). */
  behaviorPreset?: string;
  exampleQuestions?: string[];
  leadCapture?: BotLeadCaptureV2;
  /** Full chatUI document (trial onboarding); when set, replaces minimal primaryColor + links merge. */
  chatUIPreset?: Record<string, unknown>;
}

export interface ShowcaseAccessSettingsInput {
  visibility: 'public' | 'private';
  messageLimitMode: 'none' | 'fixed_total';
  messageLimitTotal?: number | null;
  messageLimitUpgradeMessage?: string | null;
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
    private readonly visitorsService: VisitorsService,
    private readonly documentsService: DocumentsService,
    private readonly ingestionService: IngestionService,
  ) { }

  async findAll() {
    return this.botModel.find().select('-secretKey').lean();
  }

  /** Count showcase bots created by this platform user (for pack generation caps). */
  async countShowcaseBotsForCreator(userId: string): Promise<number> {
    if (!Types.ObjectId.isValid(userId)) return 0;
    return this.botModel.countDocuments({
      type: 'showcase',
      createdByUserId: new Types.ObjectId(userId),
    });
  }

  /** Primary accent colors already used by this user's showcase bots (for unique pack colors). */
  async listShowcasePrimaryColorsForCreator(userId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const rows = await this.botModel
      .find({
        type: 'showcase',
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

  /** Display names of showcase bots by this creator (for unique pack names). */
  async listShowcaseNamesForCreator(userId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const rows = await this.botModel
      .find({
        type: 'showcase',
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
  async findShowcaseByClientDraftId(clientDraftId: string): Promise<Record<string, unknown> | null> {
    const trimmed = clientDraftId?.trim();
    if (!trimmed) return null;
    const b = await this.botModel.findOne({ clientDraftId: trimmed, type: 'showcase' }).lean();
    return b ? (b as Record<string, unknown>) : null;
  }

  /**
   * List bots for user panel with optional status filter (showcase only).
   * `superadmin` sees all showcase bots; `customer` sees bots in their workspaces or legacy owner/created bots without workspaceId.
   */
  async findForAdminList(
    status?: 'draft' | 'published' | 'all',
    access?: { userId: string; platformRole: string; workspaceIds: Types.ObjectId[] },
  ) {
    const base: Record<string, unknown> = { type: 'showcase' };
    if (status && status !== 'all') base.status = status;

    if (!access || access.platformRole === 'superadmin') {
      return this.botModel
        .find(base)
        .sort({ createdAt: -1 })
        .select(
          'name type category status isPublic createdAt _id slug visibility creatorType messageLimitMode messageLimitTotal workspaceId chatUI avatarEmoji imageUrl',
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
        { $or: [{ ownerUserId: userOid }, { createdByUserId: userOid }] },
      ],
    });

    return this.botModel
      .find({ ...base, $or: orClause })
      .sort({ createdAt: -1 })
      .select(
        'name type category status isPublic createdAt _id slug visibility creatorType messageLimitMode messageLimitTotal workspaceId chatUI avatarEmoji imageUrl',
      )
      .lean();
  }

  /**
   * Anonymous public gallery: **showcase** bots only.
   * Visitor-owned trial bots (`type: 'visitor-own'`) are not listed here — they are not anonymous marketing demos.
   */
  async findPublicShowcase(): Promise<PublicBotDto[]> {
    const docs = await this.botModel
      .find({
        type: 'showcase',
        isPublic: true,
        status: 'published',
        visibility: 'public',
      })
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
      exampleQuestions: Array.isArray(bot.exampleQuestions)
        ? (bot.exampleQuestions as unknown[]).map((q) => String(q ?? '').trim()).filter(Boolean) as string[]
        : [],
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
      },
    }));
    return this.attachTotalChats(
      await this.attachKnowledgeBaseCounts(
        await this.attachKnowledgeNotePreview(await this.attachKnowledgeBasePreview(bots)),
      ),
    );
  }

  /**
   * Published public showcase bots whose creating user has role `superadmin`.
   * Used by the marketing landing site with API-key auth (not for anonymous gallery).
   */
  async findPublicShowcaseBySuperAdminCreators(): Promise<PublicBotDto[]> {
    const superAdmins = await this.userModel
      .find({ role: 'superadmin' })
      .select('_id')
      .lean();
    const creatorIds = (superAdmins as { _id: unknown }[])
      .map((u) => u._id)
      .filter((id) => id != null);
    if (creatorIds.length === 0) return [];

    const docs = await this.botModel
      .find({
        type: 'showcase',
        isPublic: true,
        status: 'published',
        visibility: 'public',
        createdByUserId: { $in: creatorIds },
      })
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
      exampleQuestions: Array.isArray(bot.exampleQuestions)
        ? (bot.exampleQuestions as unknown[]).map((q) => String(q ?? '').trim()).filter(Boolean) as string[]
        : [],
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
      },
    }));
    return this.attachTotalChats(
      await this.attachKnowledgeBaseCounts(
        await this.attachKnowledgeNotePreview(await this.attachKnowledgeBasePreview(bots)),
      ),
    );
  }

  /** Minimal id lookup for public document download (showcase, published, public). */
  async findPublicShowcaseBotIdBySlug(slug: string): Promise<string | null> {
    const doc = await this.botModel
      .findOne({
        slug: slug.trim().toLowerCase(),
        type: 'showcase',
        isPublic: true,
        status: 'published',
        visibility: 'public',
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
    return { documents: 0, faqs: 0, notes: 0, urls: 0, html: 0 };
  }

  /**
   * Counts ready, active knowledge rows per bot and sourceType (full totals, not preview-capped).
   * Only rows whose parent bot is **type `showcase`**, **published**, **public**, and **isPublic** are included
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
          sourceType: { $in: ['document', 'faq', 'note', 'url', 'html'] },
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
                type: 'showcase',
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
          sourceType: { $in: ['document', 'faq', 'note', 'url', 'html'] },
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
                type: 'showcase',
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

  /** Find showcase bot by slug for chat (returns BotLike shape; faqs and knowledgeDescription from KB). */
  async findOneBySlugForChat(slug: string) {
    const bot = await this.botModel
      .findOne({ slug: slug.trim().toLowerCase(), type: 'showcase' })
      .select('_id slug name shortDescription description category openaiApiKeyOverride welcomeMessage leadCapture personality config type limitOverrideMessages includeNameInKnowledge includeTaglineInKnowledge')
      .lean();
    if (!bot) return null;
    const [faqs, knowledgeDescription] = await Promise.all([
      this.knowledgeBaseItemService.getFaqsForBot(String((bot as { _id: unknown })._id)),
      this.knowledgeBaseItemService.getNoteContentForBot(String((bot as { _id: unknown })._id)),
    ]);
    return { ...bot, faqs, knowledgeDescription } as Record<string, unknown>;
  }

  /** Find visitor-own bot by slug for chat (faqs and knowledgeDescription from KB). */
  async findOneBySlugTrial(slug: string) {
    const bot = await this.botModel
      .findOne({ slug: slug.trim().toLowerCase(), type: 'visitor-own' })
      .select('_id slug name shortDescription description category openaiApiKeyOverride welcomeMessage leadCapture personality config type limitOverrideMessages includeNameInKnowledge includeTaglineInKnowledge')
      .lean();
    if (!bot) return null;
    const [faqs, knowledgeDescription] = await Promise.all([
      this.knowledgeBaseItemService.getFaqsForBot(String((bot as { _id: unknown })._id)),
      this.knowledgeBaseItemService.getNoteContentForBot(String((bot as { _id: unknown })._id)),
    ]);
    return { ...bot, faqs, knowledgeDescription } as Record<string, unknown>;
  }

  /**
   * Public embed widget bootstrap: same visibility rules as {@link findPublicShowcase}
   * (published + public). Safe fields only — no API keys or internal config.
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
    const exampleQuestions = Array.isArray(b.exampleQuestions)
      ? (b.exampleQuestions as unknown[]).map((q) => String(q ?? '').trim()).filter(Boolean) as string[]
      : [];
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
      exampleQuestions,
    };
  }

  /** External runtime bot lookup (widget init/chat): includes access/policy fields. */
  async findOneByIdForExternalRuntime(botId: string): Promise<Record<string, unknown> | null> {
    const id = botId?.trim();
    if (!id || !Types.ObjectId.isValid(id)) return null;
    const bot = await this.botModel
      .findById(new Types.ObjectId(id))
      .select(
        '_id slug name shortDescription description category avatarEmoji imageUrl openaiApiKeyOverride welcomeMessage leadCapture personality config chatUI type status isPublic visibility accessKey secretKey creatorType ownerUserId createdByUserId ownerVisitorId messageLimitMode messageLimitTotal messageLimitUpgradeMessage includeNameInKnowledge includeTaglineInKnowledge exampleQuestions allowedDomains websiteURLAllowlist visitorMultiChatEnabled visitorMultiChatMax',
      )
      .lean();
    if (!bot) return null;
    const [faqs, knowledgeDescription] = await Promise.all([
      this.knowledgeBaseItemService.getFaqsForBot(String((bot as { _id: unknown })._id)),
      this.knowledgeBaseItemService.getNoteContentForBot(String((bot as { _id: unknown })._id)),
    ]);
    return { ...bot, faqs, knowledgeDescription } as Record<string, unknown>;
  }

  /** Find one bot by slug for demo/trial page (public shape; faqs from KB). */
  async findOneBySlugForPage(
    slug: string,
    type: 'showcase' | 'visitor-own',
  ): Promise<{
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
    const doc = await this.botModel
      .findOne({
        slug: slug.trim().toLowerCase(),
        type,
        isPublic: true,
        status: 'published',
        visibility: 'public',
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
      exampleQuestions: Array.isArray(b.exampleQuestions)
        ? (b.exampleQuestions as unknown[]).map((q) => String(q ?? '').trim()).filter(Boolean) as string[]
        : [],
    };
  }

  /** Find bot by id, for ownership check (id + ownerVisitorId + type). */
  async findOneForOwnership(id: string) {
    return this.botModel
      .findById(id)
      .select('_id ownerVisitorId type')
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

  /** Find showcase bot for user panel GET (faqs and knowledgeDescription from KB). */
  async findOneShowcaseForAdmin(id: string) {
    const bot = await this.botModel
      .findById(id)
      .select('slug name shortDescription description category categories imageUrl openaiApiKeyOverride whisperApiKeyOverride welcomeMessage status isPublic leadCapture chatUI exampleQuestions personality type config limitOverrideMessages visibility accessKey secretKey creatorType ownerUserId ownerVisitorId messageLimitMode messageLimitTotal messageLimitUpgradeMessage visitorMultiChatEnabled visitorMultiChatMax includeNameInKnowledge includeTaglineInKnowledge includeNotesInKnowledge allowedDomains websiteURLAllowlist workspaceId')
      .lean();
    if (!bot) return null;
    const [faqs, knowledgeDescription] = await Promise.all([
      this.knowledgeBaseItemService.getFaqsForBot(id, { includeInactive: true }),
      this.knowledgeBaseItemService.getNoteContentForBot(id),
    ]);
    return { ...bot, faqs, knowledgeDescription } as Record<string, unknown>;
  }

  async create(data: Record<string, unknown>) {
    const doc = await this.botModel.create(data);
    return doc.toObject();
  }

  async createVisitorTrialBot(input: CreateVisitorTrialBotInput): Promise<{
    botId: string;
    platformVisitorId: string;
    /** @deprecated legacy alias for platformVisitorId */
    visitorId?: string;
    accessKey: string;
    status: 'published';
    visibility: 'public';
    isPublic: true;
    type: 'visitor-own';
    slug: string;
    name: string;
    welcomeMessage?: string;
    imageUrl?: string;
    avatarEmoji?: string;
    messageLimitMode: 'none';
    messageLimitTotal: null;
    messageLimitUpgradeMessage: null;
  }> {
    const platformVisitorId = String((input.platformVisitorId ?? input.visitorId) || '').trim();
    if (!platformVisitorId) {
      throw new Error('platformVisitorId is required.');
    }

    const safeName = String(input.name ?? '').trim() || 'Trial Assistant';
    const safeWelcome = String(input.welcomeMessage ?? '').trim();
    const safeShortDescription = String(input.shortDescription ?? '').trim();
    let safeDescription = String(input.description ?? '').trim();
    const safeImageUrl = String(input.imageUrl ?? '').trim();
    const safeAvatarEmoji = String(input.avatarEmoji ?? '').trim();

    const allowedDomainNorm = normalizeUserWebsiteInputToHostname(String(input.allowedDomain ?? ''));
    if (!allowedDomainNorm) {
      throw new Error(
        'allowedDomain is required and must be a valid public hostname (paste a URL or hostname; we store only the hostname).',
      );
    }

    const extraHosts = (input.extraAllowedDomains ?? [])
      .map((s) => normalizeUserWebsiteInputToHostname(String(s ?? '').trim()))
      .filter((h): h is string => Boolean(h));
    /** Trial `visitor` bots may only store one hostname in `allowedDomains` (embed policy). */
    const allowedDomainsMerged = [allowedDomainNorm];
    assertTrialBotAllowedDomainsPolicy('visitor', allowedDomainsMerged);
    const extraOnly = extraHosts.filter((h) => h !== allowedDomainNorm);
    if (extraOnly.length) {
      const line = `\n\nAdditional domains to configure: ${extraOnly.join(', ')}`;
      safeDescription = (safeDescription + line).slice(0, 1500);
    }

    const cats = (input.categories ?? [])
      .map((c) => String(c ?? '').trim().slice(0, 64))
      .filter(Boolean)
      .slice(0, 32);
    const brand = String(input.brandColor ?? '').trim();
    const primaryColor =
      brand.startsWith('#') && brand.length >= 4 ? brand.slice(0, 32) : '#14B8A6';
    const links = (input.menuQuickLinks ?? [])
      .filter((l) => l && typeof l.text === 'string' && typeof l.route === 'string')
      .slice(0, 10)
      .map((l) => ({
        text: l.text.trim().slice(0, 80),
        route: l.route.trim().slice(0, 2000),
        ...(l.icon ? { icon: String(l.icon).slice(0, 64) } : {}),
      }));
    const sys = String(input.personalitySystemPrompt ?? '').trim().slice(0, 12000);
    const toneRaw = String(input.personalityTone ?? '').trim().toLowerCase();
    const toneOk = (['friendly', 'formal', 'playful', 'technical'] as const).find((t) => t === toneRaw);
    const presetOk = coerceBehaviorPreset(input.behaviorPreset);
    const personalityDoc: Record<string, unknown> = {};
    if (sys) personalityDoc.systemPrompt = sys;
    if (toneOk) personalityDoc.tone = toneOk;
    if (presetOk) personalityDoc.behaviorPreset = presetOk;
    const personality = Object.keys(personalityDoc).length ? personalityDoc : undefined;

    const exampleQuestions = (input.exampleQuestions ?? [])
      .map((q) => String(q ?? '').trim())
      .filter(Boolean)
      .slice(0, 12);

    const chatUIPreset = input.chatUIPreset;
    const chatUIDoc: Record<string, unknown> =
      chatUIPreset && Object.keys(chatUIPreset).length > 0
        ? (chatUIPreset as Record<string, unknown>)
        : {
            primaryColor,
            ...(links.length ? { menuQuickLinks: links, showMenuQuickLinks: true } : {}),
          };

    let slug = await this.generateUniqueSlug(safeName || 'trial-bot');
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const created = await this.botModel.create({
          name: safeName,
          slug,
          type: 'visitor-own',
          creatorType: 'visitor',
          ownerVisitorId: platformVisitorId,
          visibility: 'public',
          accessKey: generateBotAccessKey(),
          secretKey: generateBotSecretKey(),
          status: 'published',
          isPublic: true,
          shortDescription: safeShortDescription || undefined,
          description: safeDescription || undefined,
          welcomeMessage: safeWelcome || undefined,
          imageUrl: safeImageUrl || undefined,
          avatarEmoji: safeAvatarEmoji || undefined,
          messageLimitMode: 'none',
          messageLimitTotal: null,
          messageLimitUpgradeMessage: null,
          includeNotesInKnowledge: true,
          ...(cats.length ? { categories: cats } : {}),
          ...(personality ? { personality } : {}),
          ...(exampleQuestions.length ? { exampleQuestions } : {}),
          ...(input.leadCapture ? { leadCapture: input.leadCapture } : {}),
          chatUI: chatUIDoc,
          allowedDomains: allowedDomainsMerged,
          websiteURLAllowlist: [],
          createdAt: new Date(),
        });
        return {
          botId: String((created as { _id: unknown })._id),
          platformVisitorId,
          // Deprecated alias for compatibility:
          visitorId: platformVisitorId,
          accessKey: (created as { accessKey: string }).accessKey,
          status: 'published',
          visibility: 'public',
          isPublic: true,
          type: 'visitor-own',
          slug: (created as { slug: string }).slug,
          name: (created as { name: string }).name,
          welcomeMessage: (created as { welcomeMessage?: string }).welcomeMessage,
          imageUrl: (created as { imageUrl?: string }).imageUrl,
          avatarEmoji: (created as { avatarEmoji?: string }).avatarEmoji,
          messageLimitMode: 'none',
          messageLimitTotal: null,
          messageLimitUpgradeMessage: null,
        };
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (e.code === 11000 && (e.keyPattern?.slug || e.keyPattern?.accessKey)) {
          slug = await this.generateUniqueSlug(safeName || 'trial-bot');
          continue;
        }
        throw err;
      }
    }
    throw new Error('Failed to allocate unique trial bot credentials.');
  }

  /**
   * Showcase runtime: pair a **saved** `platformVisitorId` with a **hostname** (from user URL or hostname) for this bot.
   * Proves control via embed `accessKey`/`secretKey` (not domain alone). Trial bots use `allowedDomains` only.
   */
  async registerShowcaseEmbedWebsiteAllowlistForRuntime(input: {
    botId: string;
    accessKey: string;
    secretKey?: string;
    platformVisitorId: string;
    websiteUrl: string;
  }): Promise<{
    ok: true;
    botId: string;
    websiteURLAllowlist: Array<{ platformVisitorId: string; websiteUrl: string }>;
  }> {
    const id = input.botId?.trim();
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new Error('E_INVALID_BOT_ID');
    }
    const bot = await this.botModel
      .findById(new Types.ObjectId(id))
      .select('_id type status creatorType visibility accessKey secretKey')
      .lean();
    if (!bot) {
      throw new Error('E_BOT_NOT_FOUND');
    }
    const botType = String((bot as { type?: string }).type ?? '');
    const creatorType = (bot as { creatorType?: string }).creatorType === 'visitor' ? 'visitor' : 'user';
    if (botType !== 'showcase') {
      throw new Error('E_SHOWCASE_ONLY');
    }
    if (creatorType === 'visitor') {
      throw new Error('E_TRIAL_BOT_NOT_SUPPORTED');
    }
    const access = validateRuntimeBotAccess(
      {
        status: (bot.status as string | undefined) ?? undefined,
        visibility: (bot.visibility as 'public' | 'private' | undefined) ?? undefined,
        accessKey: (bot.accessKey as string | undefined) ?? undefined,
        secretKey: (bot.secretKey as string | undefined) ?? undefined,
      },
      { accessKey: input.accessKey, secretKey: input.secretKey },
    );
    if (!access.ok) {
      throw new Error(`E_ACCESS_${access.reason}`);
    }
    let row: { platformVisitorId: string; websiteUrl: string };
    try {
      row = normalizeWebsiteURLAllowlistRowPublic({
        platformVisitorId: input.platformVisitorId,
        websiteUrl: input.websiteUrl,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      throw new Error(msg || 'E_ALLOWLIST_NORMALIZE');
    }
    assertWebsiteURLAllowlistWritePolicy('user', [row]);
    await this.botModel.updateOne({ _id: new Types.ObjectId(id) }, { $set: { websiteURLAllowlist: [row] } });
    return { ok: true, botId: id, websiteURLAllowlist: [row] };
  }

  async updateShowcaseAccessSettings(
    id: string,
    input: ShowcaseAccessSettingsInput,
  ): Promise<{
    ok: true;
    botId: string;
    visibility: 'public' | 'private';
    accessKey: string;
    secretKey: string;
    creatorType: 'user' | 'visitor';
    ownerVisitorId?: string;
    messageLimitMode: 'none' | 'fixed_total';
    messageLimitTotal: number | null;
    messageLimitUpgradeMessage: string | null;
    visitorMultiChatEnabled: boolean;
    visitorMultiChatMax: number | null;
  }> {
    const existing = await this.botModel
      .findById(id)
      .select('_id type visibility accessKey secretKey creatorType ownerVisitorId messageLimitMode messageLimitTotal messageLimitUpgradeMessage')
      .lean();
    if (!existing || (existing as { type?: string }).type !== 'showcase') {
      throw new Error('Bot not found');
    }
    const visibility = input.visibility === 'private' ? 'private' : 'public';
    const messageLimitMode = input.messageLimitMode === 'fixed_total' ? 'fixed_total' : 'none';
    const parsedTotal =
      typeof input.messageLimitTotal === 'number' && Number.isFinite(input.messageLimitTotal)
        ? Math.floor(input.messageLimitTotal)
        : null;
    if (messageLimitMode === 'fixed_total' && (!parsedTotal || parsedTotal <= 0)) {
      throw new Error('messageLimitTotal must be a positive integer when messageLimitMode is fixed_total.');
    }
    const messageLimitTotal = messageLimitMode === 'fixed_total' ? parsedTotal : null;
    const upgradeMessageRaw =
      typeof input.messageLimitUpgradeMessage === 'string'
        ? input.messageLimitUpgradeMessage.trim()
        : '';
    const messageLimitUpgradeMessage = upgradeMessageRaw ? upgradeMessageRaw : null;

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
          messageLimitMode,
          messageLimitTotal,
          messageLimitUpgradeMessage,
          visitorMultiChatEnabled,
          visitorMultiChatMax,
        },
        { new: true },
      )
      .select('_id visibility accessKey secretKey creatorType ownerVisitorId messageLimitMode messageLimitTotal messageLimitUpgradeMessage visitorMultiChatEnabled visitorMultiChatMax')
      .lean();
    if (!updated) throw new Error('Bot not found');
    const bot = updated as Record<string, unknown>;
    return {
      ok: true,
      botId: String(bot._id),
      visibility: bot.visibility === 'private' ? 'private' : 'public',
      accessKey: String(bot.accessKey ?? ''),
      secretKey: String(bot.secretKey ?? ''),
      creatorType: bot.creatorType === 'visitor' ? 'visitor' : 'user',
      ownerVisitorId: typeof bot.ownerVisitorId === 'string' ? bot.ownerVisitorId : undefined,
      messageLimitMode: bot.messageLimitMode === 'fixed_total' ? 'fixed_total' : 'none',
      messageLimitTotal: typeof bot.messageLimitTotal === 'number' ? bot.messageLimitTotal : null,
      messageLimitUpgradeMessage:
        typeof bot.messageLimitUpgradeMessage === 'string' ? bot.messageLimitUpgradeMessage : null,
      visitorMultiChatEnabled: (bot as { visitorMultiChatEnabled?: boolean }).visitorMultiChatEnabled === true,
      visitorMultiChatMax: normalizeVisitorMultiChatMax((bot as { visitorMultiChatMax?: unknown }).visitorMultiChatMax),
    };
  }

  async rotateShowcaseAccessKey(id: string): Promise<{ ok: true; botId: string; accessKey: string }> {
    const updated = await this.botModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), type: 'showcase' },
        { accessKey: generateBotAccessKey() },
        { new: true },
      )
      .select('_id accessKey')
      .lean();
    if (!updated) throw new Error('Bot not found');
    return { ok: true, botId: String((updated as { _id: unknown })._id), accessKey: String((updated as { accessKey?: unknown }).accessKey ?? '') };
  }

  async rotateShowcaseSecretKey(id: string): Promise<{ ok: true; botId: string; secretKey: string }> {
    const updated = await this.botModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), type: 'showcase' },
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
      .findOne({ clientDraftId, status: 'draft', type: 'showcase' })
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
          const dup = await this.botModel.findOne({ clientDraftId, status: 'draft', type: 'showcase' }).select('_id slug').lean();
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
      knowledgeDescription?: string;
      leadCapture?: unknown;
      chatUI?: unknown;
      faqs?: unknown;
      exampleQuestions?: string[];
      personality?: unknown;
      config?: unknown;
      limitOverrideMessages?: number;
      isPublic: boolean;
      includeNameInKnowledge?: boolean;
      includeTaglineInKnowledge?: boolean;
      includeNotesInKnowledge: boolean;
      visibility?: 'public' | 'private';
      messageLimitMode?: 'none' | 'fixed_total';
      messageLimitTotal?: number | null;
      messageLimitUpgradeMessage?: string | null;
      allowedDomains?: string[];
      websiteURLAllowlist?: Array<{ platformVisitorId: string; websiteUrl: string }>;
    },
    createdByUserId?: string,
  ): Promise<{ botId: string; slug: string }> {
    const finalName = normalized.name || 'Draft bot';
    const finalDescription = normalized.description || '';
    const publishRules = parseAllowedDomainRulesFromStoredArray(normalized.allowedDomains ?? []);
    if (publishRules.length === 0) {
      throw new Error('At least one allowed embed domain is required to publish.');
    }
    const creatorOid =
      createdByUserId && Types.ObjectId.isValid(createdByUserId)
        ? new Types.ObjectId(createdByUserId)
        : undefined;
    const existing = await this.botModel
      .findOne({ clientDraftId })
      .select('_id slug name createdAt createdByUserId accessKey secretKey creatorType ownerUserId visibility messageLimitMode messageLimitTotal messageLimitUpgradeMessage workspaceId')
      .lean();
    const creatorTypeForAllowlist: 'user' | 'visitor' =
      existing && (existing as { creatorType?: string }).creatorType === 'visitor' ? 'visitor' : 'user';
    assertWebsiteURLAllowlistWritePolicy(
      existing ? creatorTypeForAllowlist : 'user',
      normalized.websiteURLAllowlist,
    );
    assertTrialBotAllowedDomainsPolicy(
      existing ? creatorTypeForAllowlist : 'user',
      normalized.allowedDomains,
    );
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
              leadCapture: normalized.leadCapture,
              chatUI: normalized.chatUI,
              exampleQuestions: normalized.exampleQuestions ?? [],
              personality: normalized.personality,
              config: normalized.config,
              limitOverrideMessages: normalized.limitOverrideMessages,
              type: 'showcase',
              status: 'published',
              clientDraftId: undefined,
              isPublic: normalized.isPublic,
              includeNameInKnowledge: normalized.includeNameInKnowledge,
              includeTaglineInKnowledge: normalized.includeTaglineInKnowledge,
              includeNotesInKnowledge: normalized.includeNotesInKnowledge,
              creatorType: (existing as { creatorType?: string }).creatorType ?? 'user',
              ownerUserId:
                (existing as { ownerUserId?: unknown }).ownerUserId ??
                creatorOid ??
                undefined,
              visibility: normalized.visibility ?? (existing as { visibility?: 'public' | 'private' }).visibility ?? 'public',
              accessKey: (existing as { accessKey?: string }).accessKey || generateBotAccessKey(),
              secretKey: (existing as { secretKey?: string }).secretKey || generateBotSecretKey(),
              messageLimitMode: normalized.messageLimitMode ?? (existing as { messageLimitMode?: 'none' | 'fixed_total' }).messageLimitMode ?? 'none',
              messageLimitTotal:
                normalized.messageLimitTotal !== undefined
                  ? normalized.messageLimitTotal
                  : (existing as { messageLimitTotal?: number | null }).messageLimitTotal ?? null,
              messageLimitUpgradeMessage:
                normalized.messageLimitUpgradeMessage !== undefined
                  ? normalized.messageLimitUpgradeMessage
                  : (existing as { messageLimitUpgradeMessage?: string | null }).messageLimitUpgradeMessage ?? null,
              ...(normalized.allowedDomains !== undefined ? { allowedDomains: normalized.allowedDomains } : {}),
              ...(normalized.websiteURLAllowlist !== undefined
                ? { websiteURLAllowlist: normalized.websiteURLAllowlist }
                : {}),
              ...(workspaceIdResolved ? { workspaceId: workspaceIdResolved } : {}),
              ...setCreatedBy,
            },
          );
          const botIdStr = String((existing as { _id: unknown })._id);
          const finalFaqs = Array.isArray(normalized.faqs)
            ? (normalized.faqs as Array<{ question?: string; answer?: string; active?: boolean }>).map((f) => ({
              question: String(f?.question ?? '').trim(),
              answer: String(f?.answer ?? '').trim(),
              active: f?.active !== false,
            })).filter((f) => f.question || f.answer)
            : [];
          const finalNote = String(normalized.knowledgeDescription ?? '').trim();
          await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botIdStr, finalFaqs);
          await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(botIdStr, finalNote);
          await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(botIdStr);
          await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(botIdStr);
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
          leadCapture: normalized.leadCapture,
          chatUI: normalized.chatUI,
          exampleQuestions: normalized.exampleQuestions ?? [],
          personality: normalized.personality,
          config: normalized.config,
          limitOverrideMessages: normalized.limitOverrideMessages,
          type: 'showcase',
          status: 'published',
          isPublic: normalized.isPublic,
          includeNameInKnowledge: normalized.includeNameInKnowledge,
          includeTaglineInKnowledge: normalized.includeTaglineInKnowledge,
          includeNotesInKnowledge: normalized.includeNotesInKnowledge,
          ...getCreatorDefaultsForUserFlow(creatorOid),
          ...(normalized.visibility ? { visibility: normalized.visibility } : {}),
          ...(normalized.messageLimitMode ? { messageLimitMode: normalized.messageLimitMode } : {}),
          ...(normalized.messageLimitTotal !== undefined ? { messageLimitTotal: normalized.messageLimitTotal } : {}),
          ...(normalized.messageLimitUpgradeMessage !== undefined ? { messageLimitUpgradeMessage: normalized.messageLimitUpgradeMessage } : {}),
          ...(normalized.allowedDomains !== undefined ? { allowedDomains: normalized.allowedDomains } : {}),
          ...(normalized.websiteURLAllowlist !== undefined
            ? { websiteURLAllowlist: normalized.websiteURLAllowlist }
            : {}),
          ...(wsForCreate ? { workspaceId: wsForCreate } : {}),
          createdAt: new Date(),
          ...(creatorOid ? { createdByUserId: creatorOid } : {}),
        });
        const botIdStr = String((created as { _id: unknown })._id);
        const finalFaqs = Array.isArray(normalized.faqs)
          ? (normalized.faqs as Array<{ question?: string; answer?: string; active?: boolean }>).map((f) => ({
            question: String(f?.question ?? '').trim(),
            answer: String(f?.answer ?? '').trim(),
            active: f?.active !== false,
          })).filter((f) => f.question || f.answer)
          : [];
        const finalNote = String(normalized.knowledgeDescription ?? '').trim();
        await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botIdStr, finalFaqs);
        await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(botIdStr, finalNote);
        await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(botIdStr);
        await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(botIdStr);
        return { botId: botIdStr, slug: (created as { slug: string }).slug };
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (!(e.code === 11000 && (e.keyPattern?.slug || e.keyPattern?.accessKey))) throw err;
      }
    }
    throw new Error('Failed to allocate unique slug.');
  }

  async updateShowcase(
    id: string,
    normalized: {
      name: string;
      shortDescription?: string;
      description?: string;
      categories: string[];
      imageUrl?: string;
      avatarEmoji?: string;
      openaiApiKeyOverride?: string;
      whisperApiKeyOverride?: string;
      welcomeMessage?: string;
      knowledgeDescription?: string;
      leadCapture?: unknown;
      chatUI?: unknown;
      faqs?: unknown;
      exampleQuestions?: string[];
      personality?: unknown;
      config?: unknown;
      limitOverrideMessages?: number;
      isPublic: boolean;
      status?: 'draft' | 'published';
      includeNameInKnowledge?: boolean;
      includeTaglineInKnowledge?: boolean;
      includeNotesInKnowledge: boolean;
      visibility?: 'public' | 'private';
      messageLimitMode?: 'none' | 'fixed_total';
      messageLimitTotal?: number | null;
      messageLimitUpgradeMessage?: string | null;
      allowedDomains?: string[];
      visitorMultiChatEnabled?: boolean;
      visitorMultiChatMax?: number | null;
      websiteURLAllowlist?: Array<{ platformVisitorId: string; websiteUrl: string }>;
    },
  ): Promise<{ ok: true; botId: string; status: string }> {
    const existing = await this.botModel.findById(id).select('_id type name slug allowedDomains creatorType').lean();
    if (!existing || (existing as { type?: string }).type !== 'showcase') {
      throw new Error('Bot not found');
    }
    const creatorTypeForAllowlist =
      (existing as { creatorType?: string }).creatorType === 'visitor' ? 'visitor' : 'user';
    assertWebsiteURLAllowlistWritePolicy(
      creatorTypeForAllowlist,
      normalized.websiteURLAllowlist,
    );
    assertTrialBotAllowedDomainsPolicy(creatorTypeForAllowlist, normalized.allowedDomains);
    const status = normalized.status === 'published' ? 'published' : 'draft';
    const messageLimitMode = normalized.messageLimitMode === 'fixed_total' ? 'fixed_total' : 'none';
    const parsedMessageLimitTotal =
      typeof normalized.messageLimitTotal === 'number' && Number.isFinite(normalized.messageLimitTotal)
        ? Math.floor(normalized.messageLimitTotal)
        : null;
    if (messageLimitMode === 'fixed_total' && (!parsedMessageLimitTotal || parsedMessageLimitTotal <= 0)) {
      throw new Error('messageLimitTotal must be a positive integer when messageLimitMode is fixed_total.');
    }
    const messageLimitTotal = messageLimitMode === 'fixed_total' ? parsedMessageLimitTotal : null;
    const messageLimitUpgradeMessage =
      typeof normalized.messageLimitUpgradeMessage === 'string' && normalized.messageLimitUpgradeMessage.trim()
        ? normalized.messageLimitUpgradeMessage.trim()
        : null;
    const finalName = normalized.name?.trim() || 'New bot';
    const description = String(normalized.description ?? '').trim();
    if (status === 'published') {
      if (!normalized.name?.trim()) throw new Error('Name is required to publish.');
      if (!description) throw new Error('Description is required to publish.');
      const rawMerged =
        normalized.allowedDomains !== undefined
          ? normalized.allowedDomains
          : Array.isArray((existing as { allowedDomains?: unknown }).allowedDomains)
            ? ((existing as { allowedDomains: string[] }).allowedDomains as string[])
            : [];
      const publishRules = parseAllowedDomainRulesFromStoredArray(rawMerged);
      if (publishRules.length === 0) {
        throw new Error('At least one allowed embed domain is required to publish.');
      }
    }
    let nextSlug = String((existing as { slug?: string }).slug ?? '');
    const shouldUpdateSlug = finalName !== String((existing as { name?: string }).name ?? '');
    if (shouldUpdateSlug) {
      nextSlug = await this.generateUniqueSlug(finalName, id);
    }

    const newFaqs = Array.isArray(normalized.faqs)
      ? (normalized.faqs as Array<{ question?: string; answer?: string; active?: boolean }>).map((f) => ({
        question: String(f?.question ?? '').trim(),
        answer: String(f?.answer ?? '').trim(),
        active: f?.active !== false,
      })).filter((f) => f.question || f.answer)
      : [];
    const newKnowledgeDescription = String(normalized.knowledgeDescription ?? '').trim();

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await this.botModel.findByIdAndUpdate(id, {
          name: finalName,
          slug: nextSlug,
          shortDescription: normalized.shortDescription ?? '',
          description,
          categories: normalized.categories,
          category: normalized.categories?.[0],
          imageUrl: normalized.imageUrl ?? '',
          avatarEmoji: normalized.avatarEmoji ?? '',
          openaiApiKeyOverride: normalized.openaiApiKeyOverride,
          whisperApiKeyOverride: normalized.whisperApiKeyOverride,
          welcomeMessage: normalized.welcomeMessage ?? '',
          exampleQuestions: normalized.exampleQuestions ?? [],
          leadCapture: normalized.leadCapture,
          chatUI: normalized.chatUI,
          personality: normalized.personality,
          config: normalized.config,
          limitOverrideMessages: normalized.limitOverrideMessages,
          isPublic: normalized.isPublic,
          status,
          includeNameInKnowledge: normalized.includeNameInKnowledge,
          includeTaglineInKnowledge: normalized.includeTaglineInKnowledge,
          includeNotesInKnowledge: normalized.includeNotesInKnowledge,
          ...(normalized.visibility ? { visibility: normalized.visibility } : {}),
          messageLimitMode,
          messageLimitTotal,
          messageLimitUpgradeMessage,
          ...(normalized.allowedDomains !== undefined ? { allowedDomains: normalized.allowedDomains } : {}),
          ...(normalized.visitorMultiChatEnabled !== undefined
            ? {
              visitorMultiChatEnabled: normalized.visitorMultiChatEnabled === true,
              visitorMultiChatMax:
                normalized.visitorMultiChatEnabled === true ? normalized.visitorMultiChatMax ?? null : null,
            }
            : {}),
          ...(normalized.websiteURLAllowlist !== undefined
            ? { websiteURLAllowlist: normalized.websiteURLAllowlist }
            : {}),
        });
        await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(id, newFaqs);
        await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(id, newKnowledgeDescription);
        await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(id);
        await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(id);
        return { ok: true, botId: id, status };
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (!(e.code === 11000 && e.keyPattern?.slug)) throw err;
        nextSlug = await this.generateUniqueSlug(finalName, id);
      }
    }
    throw new Error('Failed to allocate unique slug.');
  }

  async update(id: string, data: Record<string, unknown>) {
    const existing = await this.botModel.findById(id).select('creatorType').lean();
    const merged = { ...data };
    if ((existing as { creatorType?: string } | null)?.creatorType === 'visitor') {
      const al = merged.websiteURLAllowlist;
      if (Array.isArray(al) && al.length > 0) {
        throw new Error('Platform visitor website URLs are not allowed on trial bots.');
      }
      merged.websiteURLAllowlist = [];
      const ad = merged.allowedDomains;
      if (Array.isArray(ad) && ad.length > 1) {
        throw new Error('Trial bots may have at most one allowed embed domain.');
      }
    }
    return this.botModel
      .findByIdAndUpdate(id, { $set: merged }, { new: true })
      .lean();
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

  /**
   * After the trial bot exists: sync notes, FAQs (with embeddings), and enqueue uploaded knowledge documents
   * for the standard ingestion pipeline. Errors are logged and swallowed so one bad asset never fails creation.
   */
  private async bootstrapTrialOnboardingKnowledgeFromDraft(botId: string, draftRow: Record<string, unknown>): Promise<void> {
    const knowledge = (draftRow.knowledge ?? {}) as { notes?: unknown; faqs?: unknown };
    const notes = String(knowledge.notes ?? '').trim();

    try {
      await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(botId, notes);
    } catch (err) {
      console.error('[trial knowledge] note upsert failed', { botId, err });
    }
    try {
      await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(botId);
    } catch (err) {
      console.error('[trial knowledge] note chunks failed', { botId, err });
    }

    const faqs = parseTrialOnboardingFaqsForKnowledgeBase(knowledge.faqs);
    try {
      await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botId, faqs);
    } catch (err) {
      console.error('[trial knowledge] FAQ upsert failed', { botId, err });
    }
    try {
      await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(botId);
    } catch (err) {
      console.error('[trial knowledge] FAQ chunks failed', { botId, err });
    }

    let publicBucket: string;
    try {
      publicBucket = getS3PublicBucketOrThrow();
    } catch (err) {
      console.error('[trial knowledge] S3 public bucket not configured; skipping document ingest bootstrap', err);
      return;
    }

    const docAssets = listKnowledgeDocumentAssetsFromDraft(draftRow.uploadedAssets);
    const uploadSessionId = getTrialOnboardingUploadSessionId();
    for (const asset of docAssets) {
      let docId: string | undefined;
      try {
        const created = await this.documentsService.create({
          botId,
          title: asset.originalFilename.slice(0, 500),
          sourceType: 'upload',
          fileName: asset.originalFilename,
          fileType: asset.mimeType || undefined,
          fileSize: asset.sizeBytes,
          status: 'queued',
          storage: 's3',
          s3Bucket: publicBucket,
          s3Key: asset.assetKey,
          ...(asset.url ? { url: asset.url } : {}),
          uploadSessionId,
        });
        docId = String((created as { _id: { toString: () => string } })._id);
      } catch (err) {
        console.error('[trial knowledge] document create failed', { botId, assetKey: asset.assetKey, err });
        continue;
      }
      try {
        await this.ingestionService.createQueuedJob(botId, docId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'queue_failed';
        console.error('[trial knowledge] ingest job enqueue failed', { botId, docId, err });
        try {
          await this.documentsService.setFailed(botId, docId, `Could not queue ingestion: ${msg}`.slice(0, 500));
        } catch {
          /* ignore */
        }
      }
    }
  }

  /**
   * Playground: real bot knowledge state for the session’s created trial agent (documents, FAQs, notes).
   */
  async getTrialBotKnowledgeSummaryForSession(rawSessionToken: string): Promise<{
    ok: true;
    botId: string;
    documents: Array<{
      id: string;
      title: string;
      fileName?: string;
      status?: string;
      error?: string;
      active: boolean;
      createdAt?: string;
    }>;
    documentCounts: {
      docsTotal: number;
      docsQueued: number;
      docsProcessing: number;
      docsReady: number;
      docsFailed: number;
      lastIngestedAt?: string;
      lastFailedDoc?: { docId: string; title: string; error: string; updatedAt?: string };
    };
    faqs: Array<{ question: string; answer: string }>;
    note: { present: boolean; length: number; preview: string };
  }> {
    const draftRow = await this.visitorsService.ensureTrialDraftLeanBySession(rawSessionToken);
    const trialAgent = draftRow.trialAgent as Record<string, unknown> | undefined;
    const botId = String(trialAgent?.botId ?? '').trim();
    if (!botId) {
      throw new HttpException(
        { error: 'Create your agent first to view knowledge status.', errorCode: 'NO_TRIAL_BOT' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const [docRows, health, faqRows, noteContent] = await Promise.all([
      this.documentsService.findByBot(botId),
      this.documentsService.getHealthSummary(botId),
      this.knowledgeBaseItemService.getFaqsForBot(botId),
      this.knowledgeBaseItemService.getNoteContentForBot(botId),
    ]);

    const documents = docRows.map((d) => {
      const row = d as Record<string, unknown>;
      const id = String(row._id ?? '');
      const created = row.createdAt;
      const createdAt =
        created instanceof Date
          ? created.toISOString()
          : typeof created === 'string'
            ? created
            : undefined;
      return {
        id,
        title: String(row.title ?? ''),
        ...(typeof row.fileName === 'string' ? { fileName: row.fileName } : {}),
        ...(typeof row.status === 'string' ? { status: row.status } : {}),
        ...(typeof row.error === 'string' && row.error.trim() ? { error: row.error.trim() } : {}),
        active: row.active !== false,
        ...(createdAt ? { createdAt } : {}),
      };
    });

    const faqs = faqRows
      .map((f) => ({
        question: String(f.question ?? '').trim(),
        answer: String(f.answer ?? '').trim(),
      }))
      .filter((f) => f.question && f.answer);

    const preview =
      noteContent.length > 600 ? `${noteContent.slice(0, 597)}…` : noteContent;

    return {
      ok: true,
      botId,
      documents,
      documentCounts: {
        docsTotal: health.docsTotal,
        docsQueued: health.docsQueued,
        docsProcessing: health.docsProcessing,
        docsReady: health.docsReady,
        docsFailed: health.docsFailed,
        ...(health.lastIngestedAt ? { lastIngestedAt: health.lastIngestedAt } : {}),
        ...(health.lastFailedDoc ? { lastFailedDoc: health.lastFailedDoc } : {}),
      },
      faqs,
      note: {
        present: noteContent.length > 0,
        length: noteContent.length,
        preview,
      },
    };
  }

  /**
   * Requeue ingestion for a single failed document on the session’s trial bot (standard ingest jobs only).
   */
  async retryTrialBotFailedDocumentIngestForSession(
    rawSessionToken: string,
    documentId: string,
  ): Promise<{ ok: true; documentId: string }> {
    const docId = String(documentId ?? '').trim();
    if (!Types.ObjectId.isValid(docId)) {
      throw new HttpException(
        { error: 'Invalid document id.', errorCode: 'INVALID_DOCUMENT_ID' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const draftRow = await this.visitorsService.ensureTrialDraftLeanBySession(rawSessionToken);
    const trialAgent = draftRow.trialAgent as Record<string, unknown> | undefined;
    const botId = String(trialAgent?.botId ?? '').trim();
    if (!botId) {
      throw new HttpException(
        { error: 'Create your agent first.', errorCode: 'NO_TRIAL_BOT' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const bot = await this.botModel.findById(botId).select('type').lean();
    if (!bot || (bot as { type?: string }).type !== 'visitor-own') {
      throw new HttpException({ error: 'Bot not found.', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    const doc = await this.documentsService.findOneByBotAndDoc(botId, docId);
    if (!doc) {
      throw new HttpException({ error: 'Document not found.', errorCode: 'DOCUMENT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    const row = doc as { status?: string; sourceType?: string };
    if (row.status !== 'failed') {
      throw new HttpException(
        {
          error: 'Only files that failed processing can be retried.',
          errorCode: 'RETRY_NOT_FAILED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const sourceType = String(row.sourceType ?? 'upload');
    const clearExtractedText = sourceType !== 'manual';

    try {
      await this.knowledgeBaseChunkService.removeDocumentKnowledgeChunksForDocument(botId, docId);
    } catch (err) {
      console.error('[trial knowledge retry] chunk cleanup failed', { botId, docId, err });
    }

    await this.ingestionService.deleteJobsByDocId(botId, docId);
    await this.documentsService.requeueDocumentForIngestion(botId, docId, { clearExtractedText });

    try {
      await this.ingestionService.createQueuedJob(botId, docId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'queue_failed';
      console.error('[trial knowledge retry] enqueue failed', { botId, docId, err });
      try {
        await this.documentsService.setFailed(
          botId,
          docId,
          `Could not queue ingestion: ${msg}`.slice(0, 500),
        );
      } catch {
        /* ignore */
      }
      throw new HttpException(
        { error: 'Could not queue this file for another try. Please try again shortly.', errorCode: 'RETRY_QUEUE_FAILED' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    return { ok: true, documentId: docId };
  }

  /** Session + `trialAgent.botId` + `ownerVisitorId` must match (not `platformVisitorId` alone). */
  private async resolveTrialWorkspaceBotOrThrow(rawSessionToken: string): Promise<{
    botId: string;
    platformVisitorId: string;
    bot: Record<string, unknown>;
  }> {
    const draftRow = await this.visitorsService.ensureTrialDraftLeanBySession(rawSessionToken);
    const platformVisitorId = String(draftRow.platformVisitorId ?? '').trim();
    if (!platformVisitorId) {
      throw new HttpException(
        { error: 'Missing visitor identity on draft.', errorCode: 'INVALID_DRAFT' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const trialAgent = draftRow.trialAgent as Record<string, unknown> | undefined;
    const botId = String(trialAgent?.botId ?? '').trim();
    if (!botId) {
      throw new HttpException(
        { error: 'Create your agent first to use the workspace.', errorCode: 'NO_TRIAL_BOT' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot.', errorCode: 'INVALID_BOT' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botModel.findById(new Types.ObjectId(botId)).lean();
    if (!bot || (bot as { type?: string }).type !== 'visitor-own') {
      throw new HttpException({ error: 'Bot not found.', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    const owner = String((bot as { ownerVisitorId?: string }).ownerVisitorId ?? '').trim();
    if (owner !== platformVisitorId) {
      throw new HttpException({ error: 'Forbidden.', errorCode: 'FORBIDDEN' }, HttpStatus.FORBIDDEN);
    }
    return { botId, platformVisitorId, bot: bot as Record<string, unknown> };
  }

  /**
   * Full trial workspace payload: profile, behavior, and knowledge (notes + FAQs from KB).
   */
  async getTrialWorkspaceAgentForSession(rawSessionToken: string): Promise<{
    ok: true;
    botId: string;
    profile: {
      name: string;
      categories: string[];
      imageUrl: string;
      brandColor: string;
      quickLinks: Array<{ text: string; route: string; icon?: string }>;
      slug: string;
      allowedDomains: string[];
      includeNameInKnowledge: boolean;
      avatarEmoji: string;
    };
    behavior: {
      shortDescription: string;
      description: string;
      welcomeMessage: string;
      exampleQuestions: string[];
      personality: { systemPrompt: string; behaviorPreset: string; tone: string; thingsToAvoid: string };
      leadCapture: Record<string, unknown>;
    };
    knowledge: {
      notes: string;
      faqs: Array<{ question: string; answer: string }>;
    };
  }> {
    const { botId, bot } = await this.resolveTrialWorkspaceBotOrThrow(rawSessionToken);
    const chatUI = (bot.chatUI ?? {}) as Record<string, unknown>;
    const personality = (bot.personality ?? {}) as Record<string, unknown>;
    const [noteContent, faqRows] = await Promise.all([
      this.knowledgeBaseItemService.getNoteContentForBot(botId),
      this.knowledgeBaseItemService.getFaqsForBot(botId),
    ]);
    const faqs = faqRows
      .map((f) => ({
        question: String(f.question ?? '').trim(),
        answer: String(f.answer ?? '').trim(),
      }))
      .filter((f) => f.question && f.answer);

    const menuLinks = Array.isArray(chatUI.menuQuickLinks) ? chatUI.menuQuickLinks : [];
    const quickLinks = menuLinks
      .filter((l): l is { text: string; route: string; icon?: string } => {
        if (!l || typeof l !== 'object') return false;
        const o = l as Record<string, unknown>;
        return typeof o.text === 'string' && typeof o.route === 'string';
      })
      .map((l) => ({
        text: String(l.text).trim(),
        route: String(l.route).trim(),
        ...(typeof l.icon === 'string' && l.icon.trim() ? { icon: l.icon.trim().slice(0, 64) } : {}),
      }));

    const primary =
      typeof chatUI.primaryColor === 'string' && chatUI.primaryColor.trim().startsWith('#')
        ? chatUI.primaryColor.trim().slice(0, 32)
        : '#14B8A6';

    const leadRaw = bot.leadCapture;
    const leadCapture =
      leadRaw != null && typeof leadRaw === 'object' && !Array.isArray(leadRaw)
        ? { ...(leadRaw as Record<string, unknown>) }
        : { enabled: false, fields: [], askStrategy: 'balanced' };

    return {
      ok: true,
      botId,
      profile: {
        name: String(bot.name ?? ''),
        categories: Array.isArray(bot.categories)
          ? (bot.categories as unknown[]).map((c) => String(c).trim()).filter(Boolean)
          : [],
        imageUrl: String(bot.imageUrl ?? '').trim(),
        brandColor: primary,
        quickLinks,
        slug: String(bot.slug ?? ''),
        allowedDomains: Array.isArray(bot.allowedDomains)
          ? (bot.allowedDomains as unknown[]).map((h) => String(h).trim()).filter(Boolean)
          : [],
        includeNameInKnowledge: Boolean((bot as { includeNameInKnowledge?: boolean }).includeNameInKnowledge),
        avatarEmoji: String((bot as { avatarEmoji?: string }).avatarEmoji ?? '')
          .trim()
          .slice(0, 12),
      },
      behavior: {
        shortDescription: String(bot.shortDescription ?? '').trim(),
        description: String(bot.description ?? '').trim(),
        welcomeMessage: String(bot.welcomeMessage ?? '').trim(),
        exampleQuestions: Array.isArray(bot.exampleQuestions)
          ? (bot.exampleQuestions as unknown[]).map((q) => String(q).trim()).filter(Boolean)
          : [],
        personality: {
          systemPrompt: String(personality.systemPrompt ?? '').trim(),
          behaviorPreset: String(personality.behaviorPreset ?? 'default').trim() || 'default',
          tone: String(personality.tone ?? '').trim(),
          thingsToAvoid: String((personality as { thingsToAvoid?: string }).thingsToAvoid ?? '').trim(),
        },
        leadCapture,
      },
      knowledge: {
        notes: noteContent,
        faqs,
      },
    };
  }

  async patchTrialWorkspaceProfileForSession(
    rawSessionToken: string,
    body: unknown,
  ): Promise<Awaited<ReturnType<BotsService['getTrialWorkspaceAgentForSession']>>> {
    const { botId } = await this.resolveTrialWorkspaceBotOrThrow(rawSessionToken);
    const patch = parseTrialWorkspaceProfilePatch(body);
    if (Object.keys(patch).length === 0) {
      return this.getTrialWorkspaceAgentForSession(rawSessionToken);
    }

    const botOid = new Types.ObjectId(botId);
    const existing = await this.botModel.findById(botOid).lean();
    if (!existing) {
      throw new HttpException({ error: 'Bot not found.', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    const $set: Record<string, unknown> = {};
    if (patch.name !== undefined) $set.name = patch.name;
    if (patch.categories !== undefined) $set.categories = patch.categories;
    if (patch.includeNameInKnowledge !== undefined) {
      $set.includeNameInKnowledge = patch.includeNameInKnowledge;
    }
    if (patch.avatarEmoji !== undefined) {
      const em = patch.avatarEmoji.trim();
      $set.avatarEmoji = em || undefined;
    }

    const chatUI = {
      ...((existing as { chatUI?: Record<string, unknown> }).chatUI ?? {}),
    };
    let chatTouched = false;

    if (patch.brandColor !== undefined) {
      chatUI.primaryColor = patch.brandColor;
      chatTouched = true;
    }
    if (patch.imageUrl !== undefined) {
      const url = patch.imageUrl.trim();
      $set.imageUrl = url || undefined;
      chatUI.launcherAvatarUrl = url;
      chatTouched = true;
    }
    if (patch.quickLinks !== undefined) {
      chatUI.menuQuickLinks = patch.quickLinks;
      chatUI.showMenuQuickLinks = patch.quickLinks.length > 0;
      chatTouched = true;
    }
    if (chatTouched) {
      $set.chatUI = chatUI;
    }

    await this.botModel.updateOne({ _id: botOid }, { $set });
    return this.getTrialWorkspaceAgentForSession(rawSessionToken);
  }

  async patchTrialWorkspaceBehaviorForSession(
    rawSessionToken: string,
    body: unknown,
  ): Promise<Awaited<ReturnType<BotsService['getTrialWorkspaceAgentForSession']>>> {
    const { botId } = await this.resolveTrialWorkspaceBotOrThrow(rawSessionToken);
    const patch = parseTrialWorkspaceBehaviorPatch(body);
    if (Object.keys(patch).length === 0) {
      return this.getTrialWorkspaceAgentForSession(rawSessionToken);
    }

    const botOid = new Types.ObjectId(botId);
    const existing = await this.botModel.findById(botOid).lean() as Record<string, unknown> | null;
    if (!existing) {
      throw new HttpException({ error: 'Bot not found.', errorCode: 'BOT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }

    const $set: Record<string, unknown> = {};
    if (patch.shortDescription !== undefined) $set.shortDescription = patch.shortDescription || undefined;
    if (patch.description !== undefined) $set.description = patch.description || undefined;
    if (patch.welcomeMessage !== undefined) $set.welcomeMessage = patch.welcomeMessage || undefined;
    if (patch.exampleQuestions !== undefined) $set.exampleQuestions = patch.exampleQuestions;

    const existingPers = (existing.personality ?? {}) as Record<string, unknown>;
    let personalityTouched = false;
    const pers = { ...existingPers };
    if (patch.systemPrompt !== undefined) {
      pers.systemPrompt = patch.systemPrompt || undefined;
      personalityTouched = true;
    }
    if (patch.behaviorPreset !== undefined) {
      pers.behaviorPreset = patch.behaviorPreset;
      personalityTouched = true;
    }
    if (patch.tone !== undefined) {
      pers.tone = patch.tone;
      personalityTouched = true;
    }
    if (patch.thingsToAvoid !== undefined) {
      pers.thingsToAvoid = patch.thingsToAvoid || undefined;
      personalityTouched = true;
    }
    if (personalityTouched) {
      $set.personality = pers;
    }

    if (patch.leadCapture !== undefined) {
      const prev = (existing.leadCapture ?? {}) as Record<string, unknown>;
      const lc = patch.leadCapture;
      const next: Record<string, unknown> = { ...prev };
      if (lc.enabled !== undefined) next.enabled = lc.enabled;
      if (lc.askStrategy !== undefined) next.askStrategy = lc.askStrategy;
      if (lc.fields !== undefined) next.fields = lc.fields;
      $set.leadCapture = next;
    }

    await this.botModel.updateOne({ _id: botOid }, { $set });
    return this.getTrialWorkspaceAgentForSession(rawSessionToken);
  }

  async patchTrialWorkspaceKnowledgeForSession(
    rawSessionToken: string,
    body: unknown,
  ): Promise<Awaited<ReturnType<BotsService['getTrialWorkspaceAgentForSession']>>> {
    const { botId } = await this.resolveTrialWorkspaceBotOrThrow(rawSessionToken);
    const patch = parseTrialWorkspaceKnowledgePatch(body);
    if (patch.notes === undefined && patch.faqs === undefined) {
      throw new HttpException(
        { error: 'Include notes and/or faqs to update.', errorCode: 'NO_UPDATES' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (patch.notes !== undefined) {
      await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(botId, patch.notes);
      try {
        await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(botId);
      } catch (err) {
        console.error('[trial workspace] note chunks after patch', { botId, err });
      }
    }

    if (patch.faqs !== undefined) {
      const faqPayload = patch.faqs.map((f) => ({
        question: f.question,
        answer: f.answer,
        active: true as const,
      }));
      await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botId, faqPayload);
      try {
        await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(botId);
      } catch (err) {
        console.error('[trial workspace] FAQ chunks after patch', { botId, err });
      }
    }

    return this.getTrialWorkspaceAgentForSession(rawSessionToken);
  }

  /**
   * Creates a visitor trial bot from the persisted onboarding draft (session-authenticated landing flow).
   */
  async createTrialAgentFromOnboardingSession(rawSessionToken: string): Promise<{
    ok: true;
    alreadyCreated?: boolean;
    draft: TrialWorkspaceDraftV3Api;
    bot: { id: string; slug: string; accessKey: string; name: string };
  }> {
    const draftRow = await this.visitorsService.ensureTrialDraftLeanBySession(rawSessionToken);
    const platformVisitorId = String(draftRow.platformVisitorId ?? '').trim();
    if (!platformVisitorId) {
      throw new HttpException(
        { error: 'Missing visitor identity on draft.', errorCode: 'INVALID_DRAFT' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const trialAgent = draftRow.trialAgent as Record<string, unknown> | undefined;
    if (trialAgent?.botId) {
      const d = await this.visitorsService.getTrialOnboardingDraftForSessionToken(rawSessionToken);
      return {
        ok: true,
        alreadyCreated: true,
        draft: d.draft,
        bot: {
          id: String(trialAgent.botId),
          slug: String(trialAgent.slug ?? ''),
          accessKey: String(trialAgent.accessKey ?? ''),
          name: String(trialAgent.name ?? ''),
        },
      };
    }

    await this.visitorsService.getOrCreateVisitor(platformVisitorId);

    const agentName = String(draftRow.agentName ?? '').trim() || 'Trial Assistant';
    const allowedWebsite = String(draftRow.allowedWebsite ?? '').trim();
    const domainNorm = normalizeUserWebsiteInputToHostname(allowedWebsite);
    if (!domainNorm) {
      throw new HttpException(
        {
          error: 'Add a valid website on the Go Live step before creating your agent.',
          errorCode: 'INVALID_DOMAIN',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const behavior = (draftRow.behavior ?? {}) as Record<string, unknown>;
    const what =
      String(behavior.whatAgentDoes ?? '').trim() || String(draftRow.describeAgent ?? '').trim();
    const weakDescription = isWeakAgentDescription(what);

    const categories = Array.isArray(draftRow.categories)
      ? (draftRow.categories as unknown[]).map((c) => String(c).trim()).filter(Boolean)
      : [];
    const primaryCategoryId = resolvePrimaryCategoryId(categories);
    const behaviorPreset = mapCategoryToBehaviorPreset(primaryCategoryId);
    const categoryContext = buildCategoryBehaviorContext(primaryCategoryId);

    const personalitySystemPromptCore = [
      what,
      behavior.tone ? `Tone: ${String(behavior.tone)}` : '',
      behavior.audience ? `Audience: ${String(behavior.audience)}` : '',
      behavior.responseStyle ? `Response style: ${String(behavior.responseStyle)}` : '',
      behavior.exampleResponsibilities
        ? `Responsibilities: ${String(behavior.exampleResponsibilities)}`
        : '',
      behavior.additionalGuidance ? `Additional: ${String(behavior.additionalGuidance)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const personalitySystemPrompt = [
      personalitySystemPromptCore,
      categoryContext
        ? `## Role focus (trial setup — behavioral context only, not a substitute for knowledge base content)\n${categoryContext}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 12000);

    const shortDescription = what.slice(0, 180);
    const description = personalitySystemPromptCore.slice(0, 1500);

    const quickLinksRaw = Array.isArray(draftRow.quickLinks) ? draftRow.quickLinks : [];
    const menuQuickLinks = quickLinksRaw
      .map((l: unknown) => {
        if (!l || typeof l !== 'object') return null;
        const o = l as Record<string, unknown>;
        const text = String(o.label ?? '').trim();
        const route = String(o.url ?? '').trim();
        if (!text || !route) return null;
        return { text: text.slice(0, 80), route: route.slice(0, 2000) };
      })
      .filter((x): x is { text: string; route: string } => x != null)
      .slice(0, 10);

    const extraRaw = String((draftRow as { allowedDomainsExtra?: string }).allowedDomainsExtra ?? '');
    const extraAllowedDomains = extraRaw
      .split(/[\n,]+/)
      .map((s) => normalizeUserWebsiteInputToHostname(s.trim()))
      .filter((h): h is string => Boolean(h));

    const brandColor = String(draftRow.brandColor ?? '').trim();
    const avatarUrl = resolveFinalAvatarUrlFromDraftRow(draftRow as Record<string, unknown>).trim();

    const toneRaw = String(behavior.tone ?? '').toLowerCase();
    const personalityTone = (['friendly', 'formal', 'playful', 'technical'] as const).find((t) =>
      toneRaw.includes(t),
    );

    const welcomeMessage = buildTrialWelcomeMessage(agentName, primaryCategoryId, what, weakDescription);
    const exampleQuestions = buildTrialExampleQuestions(agentName, primaryCategoryId, what, weakDescription);
    const chatUIPreset = buildTrialVisitorChatUIPreset({
      primaryColor: brandColor,
      launcherAvatarUrl: avatarUrl,
      menuQuickLinks,
    });
    const leadCapture = buildDefaultTrialLeadCapture();

    let created;
    try {
      created = await this.createVisitorTrialBot({
        platformVisitorId,
        allowedDomain: domainNorm,
        extraAllowedDomains,
        name: agentName,
        imageUrl: avatarUrl || undefined,
        welcomeMessage,
        shortDescription: shortDescription || agentName,
        description: description || shortDescription || agentName,
        categories,
        brandColor,
        menuQuickLinks,
        personalitySystemPrompt: personalitySystemPrompt || undefined,
        personalityTone,
        behaviorPreset,
        exampleQuestions,
        leadCapture,
        chatUIPreset,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('allowedDomain')) {
        throw new HttpException({ error: msg, errorCode: 'TRIAL_EMBED_DOMAIN_INVALID' }, HttpStatus.BAD_REQUEST);
      }
      throw err;
    }

    await this.bootstrapTrialOnboardingKnowledgeFromDraft(created.botId, draftRow);

    await this.visitorsService.setTrialAgentOnDraft(rawSessionToken, {
      botId: created.botId,
      slug: created.slug,
      accessKey: created.accessKey,
      name: created.name,
      imageUrl: created.imageUrl,
      allowedDomain: domainNorm,
      createdAt: new Date(),
    });

    await this.visitorsService.createVisitorEvent({
      platformVisitorId,
      type: 'trial_bot_created',
      botId: created.botId,
      botSlug: created.slug,
    });

    const final = await this.visitorsService.getTrialOnboardingDraftForSessionToken(rawSessionToken);
    return {
      ok: true,
      draft: final.draft,
      bot: {
        id: created.botId,
        slug: created.slug,
        accessKey: created.accessKey,
        name: created.name,
      },
    };
  }
}
