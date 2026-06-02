import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DEFAULT_WIDGET_EMBED_RATE_LIMIT_PER_MINUTE } from '../models/bot.schema';
import {
  Bot,
  Conversation,
  ExtractJob,
  TrainJob,
  KnowledgeBaseChunk,
  KnowledgeBaseItem,
  Message,
  SummaryJob,
  User,
  VisitorEvent,
  TableImportJob,
} from '../models';
import { getDefaultBotCreatePayload } from '../workspace/shared/default-new-bot.payload';
import { buildCustomerListingDraftBotPreset } from '../workspace/shared/default-customer-listing-bot.preset';
import type { CustomerListingDraftOverrides } from '../workspace/shared/default-customer-listing-bot.preset';
import { botKnowledgeBootstrapDefaults } from '../workspace/shared/default-bot-knowledge-bootstrap.util';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { effectiveKbDocumentFileMetaLean } from '../knowledge/knowledge-base-document-sync-fields.util';
import { buildOnboardingPersonalityFromDescription } from '../workspaces/build-onboarding-personality-from-description.util';
import { buildAgentDescriptionFromOnboardingInstructions } from '../workspaces/build-agent-description-from-onboarding-instructions.util';
import { buildOnboardingExampleQuestionsFromProfile } from '../workspaces/build-onboarding-example-questions.util';
import {
  buildDefaultOnboardingBotPreset,
  buildOnboardingMenuQuickLinksFromAllowedOrigins,
} from '../workspace/shared/default-onboarding-bot.preset';
import { generateBotAccessKey, generateBotSecretKey } from './bot-keys.util';
import type { AllowedOrigin } from './origin-validation.util';
import { coerceAllowedOriginsFromBotDoc } from './origin-validation.util';
import { normalizeVisitorMultiChatMax } from './visitor-multi-chat.util';
import { KNOWLEDGE_QA_MAX, KNOWLEDGE_SNIPPETS_MAX, KNOWLEDGE_TABLES_MAX } from '../workspace/shared/bot-field-limits';
import { incomingTableSectionUtf8Bytes } from '../knowledge/bot-knowledge-total-incoming.util';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceBrandingEntitlementService } from '../entitlements/workspace-branding-entitlement.service';
import { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import {
  botKnowledgeSizeConfigIsMissing,
  buildBotKnowledgeSizeFromEntitlements,
} from '../entitlements/bot-knowledge-size-from-entitlements.util';
import {
  normalizeWorkspaceBotPatch,
  normalizeWorkspaceKnowledgeDatasheetsArray,
  normalizeWorkspaceKnowledgeDescriptionField,
  normalizeWorkspaceKnowledgeFaqsArray,
  normalizeWorkspaceKnowledgeSnippetsArray,
  normalizeWorkspaceKnowledgeSuggestionsArray,
  type WorkspaceBotPatchNormalized,
} from '../workspace/shared/bot-payload';
import { buildCustomerEmbedSnippet } from '../workspace/shared/customer-embed-snippet.util';
import type { BotLifecycleAction } from '../workspace/shared/bot-lifecycle-action.dto';
import {
  EXAMPLE_QUESTIONS_STORAGE_MAX,
  type ExampleQuestionDoc,
  exampleQuestionsToPublicLabels,
  exampleQuestionDocsToMongoArray,
  parseExampleQuestionsFromDoc,
  parseExampleQuestionSingleAppendBody,
} from '../workspace/shared/example-questions.util';
import { randomBytes } from 'crypto';
import { botIsEffectivelyDeleted, botNotDeletedClause } from './bot-not-deleted.util';
import { buildPlatformBotPublicMongoFilter } from '../platform-bots/platform-bot-public-filter.util';

/** Shallow merge for dedicated KB row PATCH bodies (`undefined` skips the key). */
function mergeKbRowPatch(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function strArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Same title/columns/rows as persisted before PATCH (ignores `active` / import meta). */
function datasheetGridCellsEqual(
  a: { title: string; columns: string[]; rows: string[][] },
  b: { title: string; columns: string[]; rows: string[][] },
): boolean {
  if (a.title !== b.title) return false;
  if (!strArraysEqual(a.columns, b.columns)) return false;
  if (a.rows.length !== b.rows.length) return false;
  for (let i = 0; i < a.rows.length; i++) {
    if (!strArraysEqual(a.rows[i] ?? [], b.rows[i] ?? [])) return false;
  }
  return true;
}

/**
 * True when normalized datasheets match prior grids on every index — only `active` (or import-only fields) may differ.
 */
function isDatasheetActiveOnlyPatch(
  prior: Array<{ title: string; columns: string[]; rows: string[][]; active?: boolean }>,
  nextNormalized: Array<{ title: string; columns: string[]; rows: string[][]; active: boolean }>,
): boolean {
  if (prior.length !== nextNormalized.length) return false;
  for (let i = 0; i < prior.length; i++) {
    const p = prior[i]!;
    const n = nextNormalized[i]!;
    if (!datasheetGridCellsEqual(p, n)) return false;
  }
  return true;
}

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
  /** Knowledge item id (`KnowledgeBaseItem` _id) for `GET .../documents/:id/download` when supported. */
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

export type CustomerBotCreateSource = 'customer_listing' | 'template_bootstrap';

export type CustomerBotCreateOptions = {
  /** When true, enforce workspace plan bot limit (customer API only). */
  enforceWorkspaceBotLimit?: boolean;
  /** When true, set botConfig.knowledgeSize from workspace plan entitlements (customer API only). */
  applyWorkspaceEntitlements?: boolean;
  /** Target workspace for the new draft (customer API). When omitted, falls back to personal workspace bootstrap. */
  workspaceId?: string;
  /**
   * `customer_listing` — clean agents-listing draft (no template KB bootstrap).
   * `template_bootstrap` or omitted — legacy template defaults (admin / internal).
   */
  source?: CustomerBotCreateSource;
  /** Optional overrides when `source` is `customer_listing`. */
  listingOverrides?: CustomerListingDraftOverrides;
};

@Injectable()
export class BotsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(KnowledgeBaseItem.name) private readonly knowledgeBaseItemModel: Model<KnowledgeBaseItem>,
    @InjectModel(KnowledgeBaseChunk.name) private readonly knowledgeBaseChunkModel: Model<KnowledgeBaseChunk>,
    @InjectModel(ExtractJob.name) private readonly extractJobModel: Model<ExtractJob>,
    @InjectModel(TrainJob.name) private readonly trainJobModel: Model<TrainJob>,
    @InjectModel(SummaryJob.name) private readonly summaryJobModel: Model<SummaryJob>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(VisitorEvent.name) private readonly visitorEventModel: Model<VisitorEvent>,
    @InjectModel(TableImportJob.name) private readonly tableImportJobModel: Model<TableImportJob>,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly workspacesService: WorkspacesService,
    private readonly workspaceBotLimitService: WorkspaceBotLimitService,
    private readonly workspaceEntitlementsService: WorkspaceEntitlementsService,
    private readonly workspaceBrandingEntitlementService: WorkspaceBrandingEntitlementService,
  ) { }

  private async buildCustomerBotConfigFromWorkspace(workspaceId: string) {
    const entitlements = await this.workspaceEntitlementsService.resolveForWorkspace(workspaceId);
    return { knowledgeSize: buildBotKnowledgeSizeFromEntitlements(entitlements) };
  }

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
      active: { $ne: false },
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    };
  }

  platformBotPublicMongoFilter(query: { type?: string }): Record<string, unknown> {
    return buildPlatformBotPublicMongoFilter(query);
  }

  private readonly publicShowcaseListSelect =
    '_id name slug shortDescription category avatarEmoji imageUrl exampleQuestions chatUI createdAt visibility accessKey';

  private leanDocsToPublicBotDto(docs: Record<string, unknown>[]): PublicBotDto[] {
    return docs.map((bot) => ({
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
  }

  private async enrichPublicShowcaseDtos(bots: PublicBotDto[]): Promise<PublicBotDto[]> {
    return this.attachTotalChats(
      await this.attachKnowledgeBaseCounts(
        await this.attachKnowledgeNotePreview(await this.attachKnowledgeBasePreview(bots)),
      ),
    );
  }

  /** Lean platform showcase bots (published, public, type showcase). */
  private async findPublishedPlatformShowcaseLeanDocs(): Promise<Record<string, unknown>[]> {
    return this.botModel
      .find(this.platformBotPublicMongoFilter({ type: 'showcase' }))
      .sort({ createdAt: -1 })
      .select(this.publicShowcaseListSelect)
      .lean() as Promise<Record<string, unknown>[]>;
  }

  /**
   * Published public platform bots for anonymous platform-bot APIs.
   */
  async findPublishedPublicPlatformBots(query: { type?: string }): Promise<Record<string, unknown>[]> {
    return this.botModel
      .find(this.platformBotPublicMongoFilter(query))
      .sort({ createdAt: -1 })
      .select(
        '_id name description shortDescription platformBotType imageUrl slug accessKey welcomeMessage welcomeMessageEnabled exampleQuestions createdAt visibility isPlatformBot status isPublic',
      )
      .lean() as Promise<Record<string, unknown>[]>;
  }

  async findPublishedPublicPlatformBotByIdOrSlug(
    idOrSlug: string,
  ): Promise<Record<string, unknown> | null> {
    const key = String(idOrSlug ?? '').trim();
    if (!key) return null;
    const base = this.platformBotPublicMongoFilter({});
    if (Types.ObjectId.isValid(key)) {
      const doc = await this.botModel
        .findOne({ $and: [{ _id: new Types.ObjectId(key) }, base] })
        .select(
          '_id name description shortDescription platformBotType imageUrl slug accessKey welcomeMessage welcomeMessageEnabled exampleQuestions createdAt visibility isPlatformBot status isPublic',
        )
        .lean();
      return doc ? (doc as Record<string, unknown>) : null;
    }
    const doc = await this.botModel
      .findOne({ $and: [{ slug: key.toLowerCase() }, base] })
      .select(
        '_id name description shortDescription platformBotType imageUrl slug accessKey welcomeMessage welcomeMessageEnabled exampleQuestions createdAt visibility isPlatformBot status isPublic',
      )
      .lean();
    return doc ? (doc as Record<string, unknown>) : null;
  }

  async findAll() {
    return this.botModel.find(botNotDeletedClause()).select('-secretKey').lean();
  }

  /** Count agents-pack bots created by this platform user (pack generation cap). */
  async countAgentsPackBotsForCreator(userId: string): Promise<number> {
    if (!Types.ObjectId.isValid(userId)) return 0;
    return this.botModel.countDocuments({
      $and: [
        { agentsPackAgent: true, createdByUserId: new Types.ObjectId(userId) },
        botNotDeletedClause(),
      ],
    });
  }

  /** Primary accent colors already used by this user's pack-generated bots (for unique pack colors). */
  async listShowcasePrimaryColorsForCreator(userId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const rows = await this.botModel
      .find({
        $and: [
          { agentsPackAgent: true, createdByUserId: new Types.ObjectId(userId) },
          botNotDeletedClause(),
        ],
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
        $and: [
          { agentsPackAgent: true, createdByUserId: new Types.ObjectId(userId) },
          botNotDeletedClause(),
        ],
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
    const b = await this.botModel
      .findOne({ $and: [{ clientDraftId: trimmed }, botNotDeletedClause()] })
      .lean();
    return b ? (b as Record<string, unknown>) : null;
  }

  /**
   * Customer workspace-scoped bot list.
   * Returns only bots whose `workspaceId` matches the given workspace.
   * Legacy bots with null/missing `workspaceId` are excluded (they are not mixed into workspace lists).
   */
  async findForCustomerWorkspaceList(
    status: 'draft' | 'published' | 'all',
    workspaceId: string,
  ) {
    if (!Types.ObjectId.isValid(workspaceId)) return [];
    const base: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(workspaceId),
    };
    if (status && status !== 'all') base.status = status;

    return this.botModel
      .find({ $and: [base, botNotDeletedClause()] })
      .sort({ createdAt: -1 })
      .select(
        'name agentsPackAgent category categories status isPublic createdAt _id slug visibility workspaceId workspaceMemberVisibility chatUI avatarEmoji imageUrl shortDescription allowedOrigins leadCapture isPlatformBot platformBotType',
      )
      .lean();
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
        .find({ $and: [base, botNotDeletedClause()] })
        .sort({ createdAt: -1 })
        .select(
          'name agentsPackAgent category status isPublic createdAt _id slug visibility workspaceId chatUI avatarEmoji imageUrl shortDescription allowedOrigins leadCapture isPlatformBot platformBotType',
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
      .find({ $and: [base, { $or: orClause }, botNotDeletedClause()] })
      .sort({ createdAt: -1 })
      .select(
        'name agentsPackAgent category status isPublic createdAt _id slug visibility workspaceId chatUI avatarEmoji imageUrl shortDescription allowedOrigins leadCapture isPlatformBot platformBotType',
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
      this.knowledgeBaseItemModel.aggregate<DateRow>([
        { $match: { botId: { $in: oids }, sourceType: 'document', status: 'ready' } },
        { $group: { _id: '$botId', lastAt: { $max: { $ifNull: ['$lastTrainedAt', '$updatedAt'] } } } },
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
   * Anonymous public gallery: prefers published public **platform showcase** bots; falls back to
   * superadmin-owned published public bots.
   */
  async findPublicShowcase(): Promise<PublicBotDto[]> {
    const platformDocs = await this.findPublishedPlatformShowcaseLeanDocs();
    if (platformDocs.length > 0) {
      return this.enrichPublicShowcaseDtos(this.leanDocsToPublicBotDto(platformDocs));
    }

    const match = await this.publicShowcaseMongoFilter();
    const docs = await this.botModel
      .find(match)
      .sort({ createdAt: -1 })
      .select(this.publicShowcaseListSelect)
      .lean();

    return this.enrichPublicShowcaseDtos(
      this.leanDocsToPublicBotDto(docs as Record<string, unknown>[]),
    );
  }

  /**
   * Same dataset as {@link findPublicShowcase} (superadmin-owned published public bots).
   * Used by the marketing landing app (API-key auth) and widget testing helpers.
   */
  async findPublicShowcaseBySuperAdminCreators(): Promise<PublicBotDto[]> {
    return this.findPublicShowcase();
  }

  /** Minimal id lookup for public document download (platform showcase first, then superadmin-owned). */
  async findPublicShowcaseBotIdBySlug(slug: string): Promise<string | null> {
    const normalized = slug.trim().toLowerCase();
    const platformDoc = await this.botModel
      .findOne({
        slug: normalized,
        ...this.platformBotPublicMongoFilter({ type: 'showcase' }),
      })
      .select('_id')
      .lean();
    if (platformDoc) return String((platformDoc as { _id: unknown })._id);

    const match = await this.publicShowcaseMongoFilter();
    const doc = await this.botModel
      .findOne({
        slug: normalized,
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
                $and: [
                  {
                    isPublic: true,
                    status: 'published',
                    visibility: 'public',
                  },
                  { active: { $ne: false } },
                  {
                    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
                  },
                ],
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
      _id: Types.ObjectId;
      botId: Types.ObjectId;
      title?: string;
      sourceType?: string;
      sourceMeta?: unknown;
      fileMeta?: unknown;
      file?: unknown;
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
                $and: [
                  {
                    isPublic: true,
                    status: 'published',
                    visibility: 'public',
                  },
                  { active: { $ne: false } },
                  {
                    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
                  },
                ],
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
      { $project: { botId: 1, title: 1, sourceType: 1, fileMeta: 1, file: 1, sourceMeta: 1 } },
    ]);

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
      const fmEff = effectiveKbDocumentFileMetaLean(row as unknown as Record<string, unknown>);
      let fileName: string | undefined;
      let fileType: string | undefined;
      if (typeof fmEff.originalName === 'string' && fmEff.originalName.trim()) fileName = fmEff.originalName.trim();
      if (typeof fmEff.mimeType === 'string' && fmEff.mimeType.trim()) fileType = fmEff.mimeType.trim();

      const docIdKb = sourceType === 'document' ? String(row._id) : undefined;
      const uploadRaw = typeof fmEff.uploadStatus === 'string' ? fmEff.uploadStatus.trim() : '';
      const downloadable =
        sourceType === 'document' &&
        uploadRaw !== 'upload_failed' &&
        (() => {
          const b = String(fmEff.storageBucket ?? '').trim();
          const k = String(fmEff.storageKey ?? '').trim();
          if (b && k) return true;
          const u = String(fmEff.url ?? '').trim();
          return /^https?:\/\//i.test(u);
        })();

      list.push({
        title,
        sourceType,
        ...(fileName ? { fileName } : {}),
        ...(fileType ? { fileType } : {}),
        ...(downloadable && docIdKb ? { documentId: docIdKb, fileDownloadable: true } : {}),
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
    if (!Types.ObjectId.isValid(id)) return null;
    return this.botModel
      .findOne({ $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] })
      .select('-secretKey')
      .lean();
  }

  /** Includes soft-deleted bots (for idempotent delete + access checks). */
  async findByIdAny(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.botModel.findById(id).select('-secretKey').lean();
  }

  /** Check if a slug exists (any type). */
  async findOneBySlug(slug: string) {
    return this.botModel
      .findOne({ $and: [{ slug: slug.trim().toLowerCase() }, botNotDeletedClause()] })
      .select('_id')
      .lean();
  }

  /** Find published public bot by slug for marketing pages (returns BotLike shape; faqs and knowledgeDescription from KB). */
  async findOneBySlugForChat(slug: string) {
    const bot = await this.botModel
      .findOne({
        $and: [
          {
            slug: slug.trim().toLowerCase(),
            isPublic: true,
            status: 'published',
            visibility: 'public',
          },
          botNotDeletedClause(),
        ],
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
        $and: [
          {
            _id: new Types.ObjectId(id),
            isPublic: true,
            status: 'published',
            visibility: 'public',
          },
          botNotDeletedClause(),
        ],
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
      .findOne({ $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] })
           .select(
        '_id slug name shortDescription description category avatarEmoji imageUrl openaiApiKeyOverride welcomeMessage leadCapture personality config translationSettings chatUI status isPublic visibility accessKey secretKey ownerId createdByUserId workspaceId workspaceMemberVisibility includeNameInKnowledge includeTaglineInKnowledge exampleQuestions allowedOrigins visitorMultiChatEnabled visitorMultiChatMax agentsPackAgent',
      )
      .lean();
    if (!bot) return null;
    const [faqs, knowledgeDescription] = await Promise.all([
      this.knowledgeBaseItemService.getFaqsForBot(String((bot as { _id: unknown })._id)),
      this.knowledgeBaseItemService.getNoteContentForBot(String((bot as { _id: unknown })._id)),
    ]);
    return { ...bot, faqs, knowledgeDescription } as Record<string, unknown>;
  }

  /** Runtime/public widget surfaces: enforce branding visibility from workspace entitlements. */
  async sanitizeRuntimeChatUiForBot(bot: {
    workspaceId?: unknown;
    chatUI?: unknown;
  }): Promise<Record<string, unknown>> {
    const chatUI =
      bot.chatUI && typeof bot.chatUI === 'object' && !Array.isArray(bot.chatUI)
        ? ({ ...(bot.chatUI as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const workspaceId = bot.workspaceId != null ? String(bot.workspaceId).trim() : '';
    return this.workspaceBrandingEntitlementService.applyBrandingEntitlementToChatUi(
      workspaceId || undefined,
      chatUI,
    );
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
    const normalized = slug.trim().toLowerCase();
    const platformDoc = await this.botModel
      .findOne({
        slug: normalized,
        ...this.platformBotPublicMongoFilter({ type: 'showcase' }),
      })
      .select(
        '_id slug name shortDescription description category avatarEmoji imageUrl welcomeMessage welcomeMessageEnabled chatUI exampleQuestions visibility accessKey',
      )
      .lean();
    const doc =
      platformDoc ??
      (await this.botModel
        .findOne({
          slug: normalized,
          ...(await this.publicShowcaseMongoFilter()),
        })
        .select(
          '_id slug name shortDescription description category avatarEmoji imageUrl welcomeMessage welcomeMessageEnabled chatUI exampleQuestions visibility accessKey',
        )
        .lean());
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
    if (!Types.ObjectId.isValid(id)) return null;
    return this.botModel
      .findOne({ $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] })
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
      .findOne({ $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] })
      .select('slug name shortDescription description category categories imageUrl avatarEmoji openaiApiKeyOverride whisperApiKeyOverride welcomeMessage welcomeMessageEnabled status isPublic leadCapture chatUI exampleQuestions personality config translationSettings limitOverrideMessages visibility accessKey secretKey ownerId visitorMultiChatEnabled visitorMultiChatMax includeNameInKnowledge includeTaglineInKnowledge includeNotesInKnowledge allowedOrigins workspaceId agentsPackAgent botConfig')
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
    const boot = botKnowledgeBootstrapDefaults();
    const ktIn = data.knowledgeTraining;
    const ksIn = data.knowledgeStats;
    const { knowledgeTraining: _kt, knowledgeStats: _ks, ...rest } = data;
    const merged: Record<string, unknown> = {
      ...boot,
      ...rest,
      knowledgeTraining:
        ktIn && typeof ktIn === 'object' && !Array.isArray(ktIn)
          ? { ...boot.knowledgeTraining, ...(ktIn as Record<string, unknown>) }
          : boot.knowledgeTraining,
      knowledgeStats:
        ksIn && typeof ksIn === 'object' && !Array.isArray(ksIn) ? ksIn : boot.knowledgeStats,
    };
    const doc = await this.botModel.create(merged);
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
      .findOne({ $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] })
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
      .findOneAndUpdate(
        { $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] },
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

  async updateWorkspaceMemberVisibility(
    id: string,
    patch: { visibleToMembers?: boolean; allowMemberPreview?: boolean },
  ): Promise<{ ok: true; botId: string; workspaceMemberVisibility: { visibleToMembers: boolean; allowMemberPreview: boolean } }> {
    if (!Types.ObjectId.isValid(id)) throw new Error('Bot not found');
    const existing = await this.botModel
      .findOne({ $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] })
      .select('_id workspaceMemberVisibility')
      .lean();
    if (!existing) throw new Error('Bot not found');

    const current =
      (existing as { workspaceMemberVisibility?: { visibleToMembers?: boolean; allowMemberPreview?: boolean } })
        .workspaceMemberVisibility ?? {};
    const next = {
      visibleToMembers:
        patch.visibleToMembers !== undefined ? patch.visibleToMembers : current.visibleToMembers !== false,
      allowMemberPreview:
        patch.allowMemberPreview !== undefined ? patch.allowMemberPreview : current.allowMemberPreview !== false,
    };

    const updated = await this.botModel
      .findOneAndUpdate(
        { $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] },
        { workspaceMemberVisibility: next },
        { new: true },
      )
      .select('_id workspaceMemberVisibility')
      .lean();
    if (!updated) throw new Error('Bot not found');

    return {
      ok: true,
      botId: String((updated as { _id: Types.ObjectId })._id),
      workspaceMemberVisibility: next,
    };
  }

  async rotateWorkspaceAccessKey(id: string): Promise<{ ok: true; botId: string; accessKey: string }> {
    const updated = await this.botModel
      .findOneAndUpdate(
        { $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] },
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
        { $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] },
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
    options?: CustomerBotCreateOptions,
  ): Promise<{ botId: string; slug: string }> {
    const existing = await this.botModel
      .findOne({ $and: [{ clientDraftId, status: 'draft' }, botNotDeletedClause()] })
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
      const explicitWorkspaceId = options?.workspaceId?.trim();
      if (explicitWorkspaceId && Types.ObjectId.isValid(explicitWorkspaceId)) {
        workspaceOid = new Types.ObjectId(explicitWorkspaceId);
      } else {
        workspaceOid = await this.workspacesService.ensurePersonalWorkspaceForUser(String(creatorOid));
      }
    }
    if (options?.enforceWorkspaceBotLimit && workspaceOid) {
      await this.workspaceBotLimitService.assertCanAddBotToWorkspace(String(workspaceOid));
    }
    let botConfigForCreate: Awaited<ReturnType<BotsService['buildCustomerBotConfigFromWorkspace']>> | undefined;
    if (options?.applyWorkspaceEntitlements && workspaceOid) {
      botConfigForCreate = await this.buildCustomerBotConfigFromWorkspace(String(workspaceOid));
    }
    const useListingDefaults = options?.source === 'customer_listing';
    const slugSeed = useListingDefaults
      ? String(options?.listingOverrides?.name ?? 'AI Agent').trim() || 'AI Agent'
      : 'ai-support-assistant';
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = await this.generateUniqueSlug(slugSeed);
      try {
        const payload = useListingDefaults
          ? buildCustomerListingDraftBotPreset(slug, clientDraftId, options?.listingOverrides)
          : getDefaultBotCreatePayload(slug, clientDraftId);
        const created = await this.create({
          ...(payload as unknown as Record<string, unknown>),
          ...getCreatorDefaultsForUserFlow(creatorOid),
          ...(creatorOid ? { createdByUserId: creatorOid } : {}),
          ...(workspaceOid ? { workspaceId: workspaceOid } : {}),
          ...(botConfigForCreate ? { botConfig: botConfigForCreate } : {}),
        });
        const botId = String((created as { _id: unknown })._id);
        if (workspaceOid && creatorOid) {
          await this.workspacesService.applyDefaultBotAccessGrantsOnBotCreate({
            workspaceId: String(workspaceOid),
            botId,
            createdByUserId: String(creatorOid),
          });
        }
        return { botId, slug: (created as { slug: string }).slug };
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (e.code === 11000 && e.keyPattern?.clientDraftId) {
          const dup = await this.botModel
            .findOne({ $and: [{ clientDraftId, status: 'draft' }, botNotDeletedClause()] })
            .select('_id slug')
            .lean();
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
    options?: CustomerBotCreateOptions,
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
      .findOne({ $and: [{ clientDraftId }, botNotDeletedClause()] })
      .select('_id slug name createdAt createdByUserId accessKey secretKey ownerId visibility workspaceId botConfig')
      .lean();
    if (existing) {
      let finalSlug = (existing as { slug: string }).slug;
      const shouldUpdateSlug = finalName !== String((existing as { name?: string }).name ?? '');
      if (!finalSlug || shouldUpdateSlug) {
        finalSlug = await this.generateUniqueSlug(finalName || 'draft-bot', String((existing as { _id: unknown })._id));
      }
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const botIdStr = String((existing as { _id: unknown })._id);
          await this.assertDocumentsExtractedBeforePublish(botIdStr);
          const setCreatedBy =
            creatorOid && !(existing as { createdByUserId?: unknown }).createdByUserId
              ? { createdByUserId: creatorOid }
              : {};
          const existingWs = (existing as { workspaceId?: Types.ObjectId }).workspaceId;
          const workspaceIdResolved =
            existingWs ??
            (creatorOid ? await this.workspacesService.ensurePersonalWorkspaceForUser(String(creatorOid)) : undefined);
          let botConfigPatch: Record<string, unknown> = {};
          if (
            options?.applyWorkspaceEntitlements &&
            workspaceIdResolved &&
            botKnowledgeSizeConfigIsMissing(existing as { botConfig?: { knowledgeSize?: { maxBytes?: number } } })
          ) {
            botConfigPatch = {
              botConfig: await this.buildCustomerBotConfigFromWorkspace(String(workspaceIdResolved)),
            };
          }
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
              ...botConfigPatch,
            },
          );
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
          await this.knowledgeBaseItemService.upsertSuggestionKnowledgeItemsForBot(
            botIdStr,
            parseExampleQuestionsFromDoc(normalized.exampleQuestions ?? []),
          );
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
        if (options?.enforceWorkspaceBotLimit && wsForCreate) {
          await this.workspaceBotLimitService.assertCanAddBotToWorkspace(String(wsForCreate));
        }
        let botConfigForCreate: Awaited<ReturnType<BotsService['buildCustomerBotConfigFromWorkspace']>> | undefined;
        if (options?.applyWorkspaceEntitlements && wsForCreate) {
          botConfigForCreate = await this.buildCustomerBotConfigFromWorkspace(String(wsForCreate));
        }
        const created = await this.create({
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
          ...(botConfigForCreate ? { botConfig: botConfigForCreate } : {}),
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
        await this.knowledgeBaseItemService.upsertSuggestionKnowledgeItemsForBot(
          botIdStr,
          parseExampleQuestionsFromDoc(normalized.exampleQuestions ?? []),
        );
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
    const existingFull = await this.botModel
      .findOne({ $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] })
      .lean();
    if (!existingFull) {
      throw new Error('Bot not found');
    }
    const ex = existingFull as Record<string, unknown>;

    if (patch.touched.size === 0) {
      const st = String(ex.status ?? '') === 'published' ? 'published' : 'draft';
      return { ok: true, botId: id, status: st };
    }

    let effectiveStatus: 'draft' | 'published' =
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

    const wasPublished = String(ex.status ?? '') === 'published';
    if (effectiveStatus === 'published' && !hasActiveAllowedOrigin(mergedOriginsForPublish)) {
      if (wasPublished && patch.touched.has('allowedOrigins')) {
        effectiveStatus = 'draft';
      } else {
        throw new Error('At least one active allowed embed origin is required to publish.');
      }
    }

    if (effectiveStatus === 'published') {
      if (!effectiveName.trim()) throw new Error('Name is required to publish.');
      if (!effectiveDescription) throw new Error('Description is required to publish.');
      if (!hasActiveAllowedOrigin(mergedOriginsForPublish)) {
        throw new Error('At least one active allowed embed origin is required to publish.');
      }
      await this.assertDocumentsExtractedBeforePublish(id);
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
    if (patch.touched.has('leadCapture')) {
      updateDoc.leadCapture = patch.leadCapture;
    }
    if (patch.touched.has('chatUI')) {
      const workspaceIdRaw = (ex.workspaceId as Types.ObjectId | string | undefined);
      const workspaceId =
        workspaceIdRaw != null && String(workspaceIdRaw).trim() ? String(workspaceIdRaw).trim() : '';
      if (workspaceId) {
        await this.workspaceBrandingEntitlementService.assertCanHideBranding(workspaceId, patch.chatUI);
      }
      let chatUiPatch: Record<string, unknown> = {};
      if (patch.chatUI && typeof patch.chatUI === 'object' && !Array.isArray(patch.chatUI)) {
        chatUiPatch = { ...(patch.chatUI as Record<string, unknown>) };
      }
      updateDoc.chatUI = workspaceId
        ? await this.workspaceBrandingEntitlementService.applyBrandingEntitlementToChatUi(
            workspaceId,
            chatUiPatch,
          )
        : chatUiPatch;
    }
    if (patch.touched.has('personality')) {
      const existingPersonality =
        ex.personality && typeof ex.personality === 'object' && !Array.isArray(ex.personality)
          ? (ex.personality as Record<string, unknown>)
          : {};
      const incomingPersonality =
        patch.personality && typeof patch.personality === 'object' ? patch.personality : {};
      updateDoc.personality = { ...existingPersonality, ...incomingPersonality };
    }
    if (patch.touched.has('config')) {
      const existingConfig =
        ex.config && typeof ex.config === 'object' && !Array.isArray(ex.config)
          ? (ex.config as Record<string, unknown>)
          : {};
      const incomingConfig = patch.config && typeof patch.config === 'object' ? patch.config : {};
      updateDoc.config = { ...existingConfig, ...incomingConfig };
      for (const key of patch.unsetConfigKeys ?? []) {
        delete (updateDoc.config as Record<string, unknown>)[key];
      }
    }
    if (patch.touched.has('translationSettings')) {
      updateDoc.translationSettings =
        patch.translationSettings && typeof patch.translationSettings === 'object'
          ? patch.translationSettings
          : { enabled: false, mode: 'english_only', transcriptLanguage: 'english' };
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
      updateDoc.status = effectiveStatus;
    } else if (
      effectiveStatus === 'draft' &&
      wasPublished &&
      patch.touched.has('allowedOrigins') &&
      !hasActiveAllowedOrigin(mergedOriginsForPublish)
    ) {
      updateDoc.status = 'draft';
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
    if (patch.touched.has('knowledgeReplyPriority') && patch.knowledgeReplyPriority) {
      updateDoc.knowledgeReplyPriority = patch.knowledgeReplyPriority;
    }

    const outStatus = effectiveStatus;

    const mongoKeys = Object.keys(updateDoc);
    if (mongoKeys.length === 0) {
      return { ok: true, botId: id, status: outStatus };
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await this.botModel.findOneAndUpdate({ $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] }, updateDoc);
        return { ok: true, botId: id, status: outStatus };
      } catch (err: unknown) {
        if (err instanceof HttpException) throw err;
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (!(e.code === 11000 && e.keyPattern?.slug)) throw err;
        if (!patch.touched.has('name')) throw err;
        nextSlug = await this.generateUniqueSlug(finalNameForSlug, id);
        updateDoc.slug = nextSlug;
      }
    }
    throw new Error('Failed to allocate unique slug.');
  }

  /**
   * Dedicated FAQ row PATCH (use `PATCH …/knowledge/faqs/:index`, not `PATCH …/bots/:id`).
   * Validates with {@link normalizeWorkspaceKnowledgeFaqsArray}.
   */
  async patchWorkspaceBotKnowledgeFaqAtIndex(
    botId: string,
    faqIndex: number,
    patchBody: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    const full = await this.knowledgeBaseItemService.getFaqsForBot(botId, { includeInactive: true });
    if (faqIndex < 0 || faqIndex >= full.length) {
      throw new HttpException({ error: 'FAQ not found', errorCode: 'kb_faq_not_found' }, HttpStatus.NOT_FOUND);
    }
    const base = full[faqIndex];
    const baseRecord: Record<string, unknown> = {
      title: base.title ?? '',
      questions: base.questions,
      question: base.question,
      answer: base.answer,
      active: base.active !== false,
    };
    const merged = mergeKbRowPatch(baseRecord, patchBody);
    const next = full.map((row, i) =>
      i === faqIndex
        ? merged
        : {
            title: row.title ?? '',
            questions: row.questions,
            question: row.question,
            answer: row.answer,
            active: row.active !== false,
          },
    );
    let faqs: ReturnType<typeof normalizeWorkspaceKnowledgeFaqsArray>;
    try {
      faqs = normalizeWorkspaceKnowledgeFaqsArray(next);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { error: e instanceof Error ? e.message : String(e) },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.knowledgeBaseItemService.assertWorkspaceBotPatchKnowledgeTrainingGates(botId, {
      faqCount: faqs.length,
      suggestionCount: 0,
      snippetCount: 0,
      knowledgeDescriptionOnlyTouchedWithoutSnippets: false,
      tableCount: 0,
    });
    await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botId, faqs);
    return { ok: true };
  }

  /** Dedicated snippet row PATCH ({@link patchWorkspaceBotKnowledgeFaqAtIndex}). */
  async patchWorkspaceBotKnowledgeSnippetAtIndex(
    botId: string,
    snippetIndex: number,
    patchBody: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    const full = await this.knowledgeBaseItemService.getSnippetsForBot(botId, { includeInactive: true });
    if (snippetIndex < 0 || snippetIndex >= full.length) {
      throw new HttpException(
        { error: 'Snippet not found', errorCode: 'kb_snippet_not_found' },
        HttpStatus.NOT_FOUND,
      );
    }
    const row = full[snippetIndex];
    const merged = mergeKbRowPatch(
      { title: row.title, snippet: row.snippet, active: row.active !== false },
      patchBody,
    );
    const next = full.map((r, i) =>
      i === snippetIndex ? merged : { title: r.title, snippet: r.snippet, active: r.active !== false },
    );
    let snippets: ReturnType<typeof normalizeWorkspaceKnowledgeSnippetsArray>;
    try {
      snippets = normalizeWorkspaceKnowledgeSnippetsArray(next);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { error: e instanceof Error ? e.message : String(e) },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.knowledgeBaseItemService.assertWorkspaceBotPatchKnowledgeTrainingGates(botId, {
      faqCount: 0,
      suggestionCount: 0,
      snippetCount: snippets.length,
      knowledgeDescriptionOnlyTouchedWithoutSnippets: false,
      tableCount: 0,
    });
    await this.knowledgeBaseItemService.upsertSnippetKnowledgeItemsForBot(botId, snippets);
    return { ok: true };
  }

  /** Dedicated datasheet / table row PATCH ({@link patchWorkspaceBotKnowledgeFaqAtIndex}). */
  async patchWorkspaceBotKnowledgeTableAtIndex(
    botId: string,
    tableIndex: number,
    patchBody: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    const full = await this.knowledgeBaseItemService.getTablesForBot(botId, { includeInactive: true });
    if (tableIndex < 0 || tableIndex >= full.length) {
      throw new HttpException(
        { error: 'Datasheet not found', errorCode: 'kb_table_not_found' },
        HttpStatus.NOT_FOUND,
      );
    }
    const row = full[tableIndex];
    const merged = mergeKbRowPatch(
      {
        title: row.title,
        columns: row.columns,
        rows: row.rows,
        active: row.active !== false,
      },
      patchBody,
    );
    const next = full.map((r, i) =>
      i === tableIndex
        ? merged
        : { title: r.title, columns: r.columns, rows: r.rows, active: r.active !== false },
    );
    let tables: ReturnType<typeof normalizeWorkspaceKnowledgeDatasheetsArray>;
    try {
      tables = normalizeWorkspaceKnowledgeDatasheetsArray(next);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { error: e instanceof Error ? e.message : String(e) },
        HttpStatus.BAD_REQUEST,
      );
    }

    const activeOnly = isDatasheetActiveOnlyPatch(full, tables);

    if (!activeOnly) {
      await this.knowledgeBaseItemService.assertWorkspaceBotPatchKnowledgeTrainingGates(botId, {
        faqCount: 0,
        suggestionCount: 0,
        snippetCount: 0,
        knowledgeDescriptionOnlyTouchedWithoutSnippets: false,
        tableCount: 0,
      });
      await this.knowledgeBaseItemService.assertKnowledgeTableIndicesNotBusyForDatasheetContentPatch(botId, [
        tableIndex,
      ]);
      const tablesBeforePayload = full.map((t) => ({
        title: t.title,
        columns: t.columns,
        rows: t.rows,
        active: t.active !== false,
      }));
      const incomingBefore = incomingTableSectionUtf8Bytes(tablesBeforePayload);
      const incomingAfter = incomingTableSectionUtf8Bytes(tables);
      const skipKbTotalLimitAssert = incomingAfter <= incomingBefore;
      await this.knowledgeBaseItemService.upsertTableKnowledgeItemsForBot(
        botId,
        tables,
        skipKbTotalLimitAssert ? { skipKbTotalLimitAssert: true } : undefined,
      );
    } else {
      await this.knowledgeBaseItemService.upsertTableKnowledgeItemsForBot(botId, tables, {
        skipKbTotalLimitAssert: true,
      });
    }
    return { ok: true };
  }

  /**
   * Append one FAQ row (`POST …/knowledge/faqs`). Validates with {@link normalizeWorkspaceKnowledgeFaqsArray}.
   * Does not apply `knowledge_training_busy` (creation); {@link upsertFaqKnowledgeItemsForBot} enforces storage/plan.
   */
  async postWorkspaceBotKnowledgeFaqAppend(
    botId: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: true; index: number }> {
    const full = await this.knowledgeBaseItemService.getFaqsForBot(botId, { includeInactive: true });
    if (full.length >= KNOWLEDGE_QA_MAX) {
      throw new HttpException(
        {
          error: `This agent already has the maximum number of Q&A entries (${KNOWLEDGE_QA_MAX}).`,
          errorCode: 'kb_faq_capacity',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const prefix = full.map((row) => ({
      title: row.title ?? '',
      questions: row.questions,
      question: row.question,
      answer: row.answer,
      active: row.active !== false,
    }));
    let faqs: ReturnType<typeof normalizeWorkspaceKnowledgeFaqsArray>;
    try {
      faqs = normalizeWorkspaceKnowledgeFaqsArray([...prefix, body]);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { error: e instanceof Error ? e.message : String(e) },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (faqs.length !== full.length + 1) {
      throw new HttpException(
        {
          error: 'FAQ could not be created. Provide a non-empty answer and at least one question or a title.',
          errorCode: 'kb_faq_body_invalid',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botId, faqs);
    return { ok: true, index: faqs.length - 1 };
  }

  /** Append one titled snippet (`POST …/knowledge/snippets`). No `knowledge_training_busy`; storage via upsert. */
  async postWorkspaceBotKnowledgeSnippetAppend(
    botId: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: true; index: number }> {
    const full = await this.knowledgeBaseItemService.getSnippetsForBot(botId, { includeInactive: true });
    if (full.length >= KNOWLEDGE_SNIPPETS_MAX) {
      throw new HttpException(
        {
          error: `This agent already has the maximum number of snippets (${KNOWLEDGE_SNIPPETS_MAX}).`,
          errorCode: 'kb_snippet_capacity',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const prefix = full.map((r) => ({
      title: r.title,
      snippet: r.snippet,
      active: r.active !== false,
    }));
    let snippets: ReturnType<typeof normalizeWorkspaceKnowledgeSnippetsArray>;
    try {
      snippets = normalizeWorkspaceKnowledgeSnippetsArray([...prefix, body]);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { error: e instanceof Error ? e.message : String(e) },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (snippets.length !== full.length + 1) {
      throw new HttpException(
        {
          error: 'Snippet could not be created. Provide non-empty snippet text.',
          errorCode: 'kb_snippet_body_invalid',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.knowledgeBaseItemService.upsertSnippetKnowledgeItemsForBot(botId, snippets);
    return { ok: true, index: snippets.length - 1 };
  }

  /** Append one datasheet (`POST …/knowledge/datasheets`). No `knowledge_training_busy`; import-busy + storage via upsert. */
  async postWorkspaceBotKnowledgeDatasheetAppend(
    botId: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: true; index: number }> {
    const full = await this.knowledgeBaseItemService.getTablesForBot(botId, { includeInactive: true });
    if (full.length >= KNOWLEDGE_TABLES_MAX) {
      throw new HttpException(
        {
          error: `Each agent can have at most ${KNOWLEDGE_TABLES_MAX} datasheets.`,
          errorCode: 'kb_table_capacity',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const prefix = full.map((r) => ({
      title: r.title,
      columns: r.columns,
      rows: r.rows,
      active: r.active !== false,
    }));
    let tables: ReturnType<typeof normalizeWorkspaceKnowledgeDatasheetsArray>;
    try {
      tables = normalizeWorkspaceKnowledgeDatasheetsArray([...prefix, body]);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { error: e instanceof Error ? e.message : String(e) },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (tables.length !== full.length + 1) {
      throw new HttpException(
        {
          error:
            'Datasheet could not be created. Provide at least one column and row data (same shape as PATCH/PUT payloads).',
          errorCode: 'kb_table_body_invalid',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.knowledgeBaseItemService.assertKnowledgeTableIndicesNotImportBusy(
      botId,
      prefix.map((_, i) => i),
    );
    await this.knowledgeBaseItemService.upsertTableKnowledgeItemsForBot(botId, tables);
    return { ok: true, index: tables.length - 1 };
  }

  /** Legacy plain-text notes / `knowledgeDescription` (`PATCH …/knowledge/description`). */
  async patchWorkspaceBotKnowledgeDescription(botId: string, body: unknown): Promise<{ ok: true }> {
    const text = normalizeWorkspaceKnowledgeDescriptionField(body);
    await this.knowledgeBaseItemService.assertKbLegacyKnowledgeDescriptionTrainingGate(botId);
    await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(botId, text);
    return { ok: true };
  }

  /**
   * Full replace of suggestion chips (`POST …/knowledge/suggestions/sync`). Plan + bot storage limits apply to
   * scoped text; `knowledge_training_busy` runs only for existing scoped KB rows whose context changes or is removed.
   */
  async syncWorkspaceBotKnowledgeSuggestionsFromPayload(botId: string, rawList: unknown): Promise<{ ok: true }> {
    if (Array.isArray(rawList) && rawList.length > EXAMPLE_QUESTIONS_STORAGE_MAX) {
      throw new HttpException(
        {
          error: `At most ${EXAMPLE_QUESTIONS_STORAGE_MAX} suggestions are allowed.`,
          errorCode: 'kb_suggestion_capacity',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    let docs: ExampleQuestionDoc[];
    try {
      docs = normalizeWorkspaceKnowledgeSuggestionsArray(rawList);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { error: e instanceof Error ? e.message : String(e) },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.knowledgeBaseItemService.assertSuggestionListSyncScopeTrainingGate(botId, docs);
    await this.botModel.updateOne(
      { $and: [{ _id: new Types.ObjectId(botId) }, botNotDeletedClause()] },
      { $set: { exampleQuestions: exampleQuestionDocsToMongoArray(docs), updatedAt: new Date() } },
    );
    await this.knowledgeBaseItemService.upsertSuggestionKnowledgeItemsForBot(botId, docs);
    return { ok: true };
  }

  /**
   * Append one suggestion chip (`POST …/knowledge/suggestions`). No `knowledge_training_busy` gate; scoped bytes
   * are asserted inside {@link KnowledgeBaseItemService.upsertSuggestionKnowledgeItemsForBot}.
   */
  async postWorkspaceBotKnowledgeSuggestionAppend(
    botId: string,
    body: Record<string, unknown>,
  ): Promise<{ ok: true; index: number }> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botModel
      .findOne({ $and: [{ _id: new Types.ObjectId(botId) }, botNotDeletedClause()] })
      .select('exampleQuestions')
      .lean();
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const existing = parseExampleQuestionsFromDoc((bot as { exampleQuestions?: unknown }).exampleQuestions);
    if (existing.length >= EXAMPLE_QUESTIONS_STORAGE_MAX) {
      throw new HttpException(
        {
          error: `This agent already has the maximum number of suggestions (${EXAMPLE_QUESTIONS_STORAGE_MAX}).`,
          errorCode: 'kb_suggestion_capacity',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const one = parseExampleQuestionSingleAppendBody(body);
    if (!one) {
      throw new HttpException(
        { error: 'Provide a label (chip text).', errorCode: 'kb_suggestion_body_invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
    let mergedDocs: ExampleQuestionDoc[];
    try {
      mergedDocs = normalizeWorkspaceKnowledgeSuggestionsArray([...existing, one] as unknown);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { error: e instanceof Error ? e.message : String(e) },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (mergedDocs.length !== existing.length + 1) {
      throw new HttpException(
        { error: 'Suggestion could not be created.', errorCode: 'kb_suggestion_body_invalid' },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.botModel.updateOne(
      { $and: [{ _id: new Types.ObjectId(botId) }, botNotDeletedClause()] },
      { $set: { exampleQuestions: exampleQuestionDocsToMongoArray(mergedDocs), updatedAt: new Date() } },
    );
    await this.knowledgeBaseItemService.upsertSuggestionKnowledgeItemsForBot(botId, mergedDocs);
    return { ok: true, index: mergedDocs.length - 1 };
  }

  private activeAllowedOriginSummary(ex: Record<string, unknown>): string[] {
    const raw = Array.isArray(ex.allowedOrigins) ? (ex.allowedOrigins as AllowedOrigin[]) : [];
    return raw
      .filter((o) => o?.isActive !== false && typeof o?.origin === 'string' && o.origin.trim() !== '')
      .map((o) => o.origin!.trim());
  }

  /**
   * Guard publish/finalize: active documents must complete extraction and have non-empty extracted text.
   */
  private async assertDocumentsExtractedBeforePublish(botId: string): Promise<void> {
    if (!Types.ObjectId.isValid(botId)) return;
    const botOid = new Types.ObjectId(botId);
    const rows = await this.knowledgeBaseItemModel
      .find({
        botId: botOid,
        sourceType: 'document',
        active: { $ne: false },
      })
      .select('title status characterCount')
      .lean();
    if (!rows.length) return;
    const notReady = rows.filter((r) => {
      const st = String((r as { status?: unknown }).status ?? '').trim().toLowerCase();
      const chars = (r as { characterCount?: unknown }).characterCount;
      const charCount = typeof chars === 'number' && Number.isFinite(chars) ? chars : 0;
      return st !== 'ready' || charCount <= 0;
    });
    if (notReady.length === 0) return;
    throw new Error(
      `Document extraction is still in progress. Wait until all active documents finish extraction before publishing (${notReady.length} remaining).`,
    );
  }

  /** Same publish rules as `updateWorkspaceBot` when transitioning to published (name, description, active origins). */
  private async assertExistingWorkspaceBotPublishableForLifecycle(ex: Record<string, unknown>): Promise<void> {
    const effectiveName = String(ex.name ?? '').trim() || 'New bot';
    const effectiveDescription = String(ex.description ?? '').trim();
    const mergedOrigins = Array.isArray(ex.allowedOrigins) ? (ex.allowedOrigins as AllowedOrigin[]) : [];
    if (!effectiveName.trim()) throw new Error('Name is required to publish.');
    if (!effectiveDescription) throw new Error('Description is required to publish.');
    if (!hasActiveAllowedOrigin(mergedOrigins)) {
      throw new Error('At least one active allowed embed origin is required to publish.');
    }
    const botId = String((ex as { _id?: unknown })._id ?? '');
    if (botId) {
      await this.assertDocumentsExtractedBeforePublish(botId);
    }
  }

  /**
   * Dedicated customer lifecycle transition (not sparse PATCH). Validates then sets `status` only.
   */
  async customerBotLifecycleAction(
    id: string,
    action: BotLifecycleAction,
    opts: { publicApiBaseUrl: string; widgetAssetOrigin: string; enforceWorkspaceBotLimit?: boolean },
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
    const existingFull = await this.botModel
      .findOne({ $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] })
      .lean();
    if (!existingFull) {
      throw new Error('Bot not found');
    }
    const ex = existingFull as Record<string, unknown>;
    const currentStatus = String(ex.status ?? '') === 'published' ? 'published' : 'draft';

    if (action === 'draft') {
      if (currentStatus !== 'draft') {
        await this.botModel.updateOne(
          { $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] },
          { $set: { status: 'draft' } },
        );
      }
      return { ok: true, action: 'draft', status: 'draft' };
    }

    await this.assertExistingWorkspaceBotPublishableForLifecycle(ex);
    if (opts.enforceWorkspaceBotLimit) {
      const wsRaw = (ex as { workspaceId?: Types.ObjectId }).workspaceId;
      let workspaceId = wsRaw != null ? String(wsRaw) : '';
      if (!workspaceId && (ex as { createdByUserId?: Types.ObjectId }).createdByUserId) {
        workspaceId = String(
          await this.workspacesService.ensurePersonalWorkspaceForUser(
            String((ex as { createdByUserId: Types.ObjectId }).createdByUserId),
          ),
        );
      }
      if (workspaceId) {
        await this.workspaceBotLimitService.assertCanAddBotToWorkspace(workspaceId, { excludeBotId: id });
      }
    }
    if (currentStatus !== 'published') {
      await this.botModel.updateOne(
        { $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] },
        { $set: { status: 'published' } },
      );
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
    return this.botModel
      .findOneAndUpdate({ $and: [{ _id: new Types.ObjectId(id) }, botNotDeletedClause()] }, { $set: data }, {
        new: true,
      })
      .lean();
  }

  async remove(id: string): Promise<{ deleted: string; alreadyDeleted?: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      return { deleted: id, alreadyDeleted: true };
    }
    const botOid = new Types.ObjectId(id);
    const now = new Date();
    const liveUpdate = await this.botModel
      .findOneAndUpdate(
        { $and: [{ _id: botOid }, botNotDeletedClause()] },
        { $set: { active: false, deletedAt: now } },
        { new: true },
      )
      .lean();

    if (!liveUpdate) {
      const tomb = await this.botModel.findById(botOid).select('active deletedAt').lean();
      if (!tomb) {
        return { deleted: id, alreadyDeleted: true };
      }
      if (botIsEffectivelyDeleted(tomb as { active?: boolean; deletedAt?: Date | null })) {
        return { deleted: id, alreadyDeleted: true };
      }
      return { deleted: id, alreadyDeleted: true };
    }

    await this.knowledgeBaseItemService.softDeleteKnowledgeItemsMatching(id, {});
    await this.knowledgeBaseChunkModel.deleteMany({ botId: botOid });
    await Promise.all([
      this.extractJobModel.deleteMany({ botId: botOid, status: 'queued' }),
      this.trainJobModel.deleteMany({ botId: botOid, status: 'queued' }),
      this.summaryJobModel.deleteMany({ botId: botOid, status: 'queued' }),
    ]);
    await this.tableImportJobModel.updateMany(
      { botId: botOid, status: { $in: ['queued' as const, 'processing' as const] } },
      {
        $set: {
          status: 'failed',
          finishedAt: now,
          error: 'Bot deleted',
          errorCode: 'kb_bot_deleted',
        },
      },
    );

    return { deleted: id, alreadyDeleted: false };
  }

  /**
   * Unique share slug for `/share/:slug` (lowercase `sc-` + hex).
   */
  async generateUniqueShareSlug(): Promise<string> {
    for (let i = 0; i < 16; i += 1) {
      const slug = `sc-${randomBytes(8).toString('hex')}`.toLowerCase();
      const exists = await this.botModel.exists({
        $and: [{ 'shareChat.slug': slug }, botNotDeletedClause()],
      });
      if (!exists) return slug;
    }
    throw new Error('Could not allocate unique share slug');
  }

  /**
   * Non-deleted bot whose `shareChat.slug` matches (enabled or not). Policy is enforced in {@link assertSharePreviewPolicy}.
   */
  async findShareBotByShareSlug(slug: string): Promise<Record<string, unknown> | null> {
    const s = String(slug ?? '').trim().toLowerCase();
    if (!s || s.length > 160) return null;
    const bot = await this.botModel
      .findOne({
        $and: [{ 'shareChat.slug': s }, botNotDeletedClause()],
      })
      .lean();
    return bot ? (bot as Record<string, unknown>) : null;
  }

  /**
   * Creates a published customer bot from workspace onboarding draft data (Epic 3B).
   * Does not use clientDraftId or template onboarding seeding.
   */
  async createPublishedBotFromWorkspaceOnboarding(input: {
    workspaceId: string;
    createdByUserId: string;
    profile: {
      name: string;
      shortDescription: string;
      description: string;
      brandColor?: string;
      categories: string[];
      avatarSource: string;
      imageUrl: string;
      avatarEmoji: string;
    };
    instructions: {
      description: string;
      systemPrompt: string;
      tone: string;
      behaviorPreset: string;
      responseLength: string;
      maxTokens: number;
    };
    allowedOrigins: AllowedOrigin[];
  }): Promise<{
    botId: string;
    slug: string;
    name: string;
    status: 'published';
    accessKey: string;
    secretKey: string;
    visibility: 'public' | 'private';
    allowedOrigins: AllowedOrigin[];
  }> {
    if (!hasActiveAllowedOrigin(input.allowedOrigins)) {
      throw new Error('At least one active allowed embed origin is required to publish.');
    }
    if (!Types.ObjectId.isValid(input.workspaceId) || !Types.ObjectId.isValid(input.createdByUserId)) {
      throw new Error('Invalid workspace or user id.');
    }

    await this.workspaceBotLimitService.assertCanAddBotToWorkspace(input.workspaceId);

    const workspaceOid = new Types.ObjectId(input.workspaceId);
    const creatorOid = new Types.ObjectId(input.createdByUserId);
    const botConfigForCreate = await this.buildCustomerBotConfigFromWorkspace(input.workspaceId);
    const categories = input.profile.categories.filter(Boolean);
    const avatarSourceRaw = input.profile.avatarSource.trim().toLowerCase();
    const avatarSource =
      avatarSourceRaw === 'upload' ||
      avatarSourceRaw === 'url' ||
      avatarSourceRaw === 'emoji' ||
      avatarSourceRaw === 'none'
        ? avatarSourceRaw
        : undefined;
    const instructionsSource = input.instructions.description.trim();
    const onboardingPersonality = buildOnboardingPersonalityFromDescription(instructionsSource);
    const agentDescription = buildAgentDescriptionFromOnboardingInstructions(instructionsSource);
    const menuQuickLinks = buildOnboardingMenuQuickLinksFromAllowedOrigins(input.allowedOrigins);
    const exampleQuestions = buildOnboardingExampleQuestionsFromProfile(categories, instructionsSource);
    const tone = input.instructions.tone?.trim() || onboardingPersonality.tone;
    const behaviorPreset =
      input.instructions.behaviorPreset?.trim() || onboardingPersonality.behaviorPreset;

    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = await this.generateUniqueSlug(input.profile.name || 'ai-assistant');
      const preset = buildDefaultOnboardingBotPreset(slug, input.workspaceId, {
        brandColor: input.profile.brandColor,
        menuQuickLinks,
        exampleQuestions,
      });
      try {
        const created = await this.create({
          ...preset,
          status: 'published',
          name: input.profile.name,
          slug,
          shortDescription: input.profile.shortDescription || undefined,
          description: agentDescription,
          categories,
          category: categories[0],
          imageUrl: input.profile.imageUrl || undefined,
          avatarEmoji: input.profile.avatarEmoji || undefined,
          ...(avatarSource ? { avatarSource } : {}),
          personality: {
            description: onboardingPersonality.instructions,
            systemPrompt: onboardingPersonality.systemPrompt,
            tone,
            behaviorPreset,
            thingsToAvoid: onboardingPersonality.avoidInstructions,
          },
          allowedOrigins: input.allowedOrigins,
          workspaceId: workspaceOid,
          ...getCreatorDefaultsForUserFlow(creatorOid),
          createdByUserId: creatorOid,
          ownerId: creatorOid,
          botConfig: botConfigForCreate,
          createdAt: new Date(),
        });
        const bot = created as unknown as Record<string, unknown>;
        const botId = String(bot._id);
        await this.workspacesService.applyDefaultBotAccessGrantsOnBotCreate({
          workspaceId: input.workspaceId,
          botId,
          createdByUserId: input.createdByUserId,
        });
        return {
          botId,
          slug: String(bot.slug ?? slug),
          name: String(bot.name ?? input.profile.name),
          status: 'published',
          accessKey: String(bot.accessKey ?? ''),
          secretKey: String(bot.secretKey ?? ''),
          visibility: bot.visibility === 'private' ? 'private' : 'public',
          allowedOrigins: coerceAllowedOriginsFromBotDoc(bot.allowedOrigins),
        };
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (!(e.code === 11000 && (e.keyPattern?.slug || e.keyPattern?.accessKey))) throw err;
      }
    }
    throw new Error('Failed to allocate unique slug.');
  }
}
