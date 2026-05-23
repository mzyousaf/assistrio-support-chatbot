import {
  Body,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { BotsService } from '../../bots/bots.service';
import { normalizeVisitorMultiChatMax } from '../../bots/visitor-multi-chat.util';
import { DocumentsService } from '../../documents/documents.service';
import { KnowledgeBaseItemService } from '../../knowledge/knowledge-base-item.service';
import { KnowledgeUsageService } from '../../knowledge/knowledge-usage.service';
import { knowledgeUsageBreakdownToApiPayload } from '../../knowledge/knowledge-usage.util';
import { normalizeBotPayload, normalizeWorkspaceBotPatch } from './bot-payload';
import { normalizeKnowledgeReplyPrioritySettings } from '../../knowledge/knowledge-reply-priority.util';
import { assertAllowedOriginsPolicy } from './allowed-origins-policy';
import { BotOnboardingService } from './bot-onboarding.service';
import type { RequestUser } from '../../auth/shared/request-user.types';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { uploadPublic } from '../../lib/s3';
import { parseExampleQuestionsFromDoc } from './example-questions.util';
import { botIsEffectivelyDeleted } from '../../bots/bot-not-deleted.util';
import { sharePreviewExpiresAtMs, sharePreviewTokenHashLooksSet } from '../../bots/share-preview-policy.util';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

function userUploadedAvatarPath(rawUrl: string): boolean {
  return /\/uploads\/bot-avatars\//i.test(rawUrl.trim());
}

function workspaceAvatarSource(b: Record<string, unknown>): 'upload' | 'url' | 'emoji' | 'none' {
  const s = b.avatarSource;
  if (s === 'upload' || s === 'url' || s === 'emoji' || s === 'none') return s;
  const emoji = typeof b.avatarEmoji === 'string' ? b.avatarEmoji.trim() : '';
  const rawUrl = typeof b.imageUrl === 'string' ? b.imageUrl.trim() : '';
  if (emoji && !rawUrl) return 'emoji';
  if (rawUrl) return userUploadedAvatarPath(rawUrl) ? 'upload' : 'url';
  return 'none';
}

/**
 * Shared workspace bot HTTP handlers for `/api/admin/bots` and `/api/customer/bots`.
 * Guard is applied only on concrete controllers.
 */
export abstract class WorkspaceBotsControllerBase {
  constructor(
    protected readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
    protected readonly botOnboardingService: BotOnboardingService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    protected readonly workspacesService: WorkspacesService,
    private readonly knowledgeUsageService: KnowledgeUsageService,
  ) {}

  protected async assertCanAccessWorkspaceBot(req: RequestWithUser, botId: string): Promise<void> {
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(uid, req.user?.role ?? '', bot as Record<string, unknown>);
    if (!ok) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }
  }

  @Post('draft')
  async createDraft(@Body() body: { clientDraftId?: string }, @Req() req: RequestWithUser) {
    const clientDraftId = String(body?.clientDraftId ?? '').trim();
    if (!clientDraftId) {
      throw new HttpException({ error: 'clientDraftId is required' }, HttpStatus.BAD_REQUEST);
    }
    const createdByUserId = req.user?._id != null ? String(req.user._id) : undefined;
    try {
      const result = await this.botsService.createDraft(clientDraftId, createdByUserId);
      await this.botOnboardingService.onboardNewBot(result.botId);
      return result;
    } catch (err) {
      console.error('Create draft bot failed', err);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('draft/finalize')
  async finalizeDraft(
    @Body() body: { clientDraftId?: string; payload?: Record<string, unknown> },
    @Req() req: RequestWithUser,
  ) {
    const clientDraftId = String(body?.clientDraftId ?? '').trim();
    if (!clientDraftId) {
      throw new HttpException({ error: 'clientDraftId is required' }, HttpStatus.BAD_REQUEST);
    }
    const draftBot = await this.botsService.findWorkspaceByClientDraftId(clientDraftId);
    if (draftBot?._id != null) {
      await this.assertCanAccessWorkspaceBot(req, String(draftBot._id));
    }
    const normalized = normalizeBotPayload(body?.payload ?? {});
    if (normalized.allowedOrigins !== undefined) {
      assertAllowedOriginsPolicy(normalized.allowedOrigins.length, req.user?.role);
    }
    const createdByUserId = req.user?._id != null ? String(req.user._id) : undefined;
    try {
      return await this.botsService.finalizeDraft(clientDraftId, normalized, createdByUserId);
    } catch (err) {
      console.error('Finalize draft bot failed', err);
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.includes('allowed origin') ||
        msg.includes('allowed embed origin') ||
        msg.includes('Document extraction is still in progress')
      ) {
        throw new HttpException({ error: msg }, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async listBots(@Req() req: RequestWithUser, @Query('status') status?: string) {
    const filter = status === 'draft' || status === 'published' ? status : 'all';
    const userId = req?.user?._id != null ? String(req.user._id) : '';
    const role = req?.user?.role ?? 'customer';
    await this.workspacesService.ensurePersonalWorkspaceForUser(userId);
    const workspaceIds = await this.workspacesService.getWorkspaceIdsForUser(userId);
    const bots = await this.botsService.findForAdminList(filter, {
      userId,
      platformRole: role,
      workspaceIds,
    });

    const botIds = (bots as Record<string, unknown>[]).map((b) => String(b._id));
    const statsMap = await this.botsService.getListStatsForBots(botIds);

    return (bots as Record<string, unknown>[]).map((b) => {
      const chatUI =
        b.chatUI && typeof b.chatUI === 'object' ? (b.chatUI as Record<string, unknown>) : {};
      const rawPrimary = typeof chatUI.primaryColor === 'string' ? chatUI.primaryColor.trim() : '';
      const primaryColor = /^#[0-9a-fA-F]{6}$/.test(rawPrimary) ? rawPrimary : '#14B8A6';
      const avatarEmoji =
        typeof b.avatarEmoji === 'string' && b.avatarEmoji.trim() !== '' ? b.avatarEmoji.trim() : undefined;
      const imageUrl =
        typeof b.imageUrl === 'string' && b.imageUrl.trim() !== '' ? b.imageUrl.trim() : undefined;
      const shortDescription =
        typeof b.shortDescription === 'string' && b.shortDescription.trim() !== ''
          ? b.shortDescription.trim()
          : undefined;

      const rawOrigins = Array.isArray((b as Record<string, unknown>).allowedOrigins)
        ? ((b as Record<string, unknown>).allowedOrigins as Array<{ origin?: string; isActive?: boolean }>)
        : [];
      const activeOrigins = rawOrigins
        .filter((o) => o?.isActive !== false && typeof o?.origin === 'string' && o.origin.trim() !== '')
        .map((o) => o.origin!.trim());

      const leadCaptureObj =
        b.leadCapture && typeof b.leadCapture === 'object'
          ? (b.leadCapture as { enabled?: boolean })
          : undefined;
      const leadCaptureEnabled = leadCaptureObj?.enabled === true;

      const id = String(b._id);
      const stats = statsMap.get(id);

      return {
        _id: id,
        name: b.name ?? '',
        agentsPackAgent: Boolean((b as { agentsPackAgent?: boolean }).agentsPackAgent),
        category: b.category ?? '',
        status: b.status ?? 'draft',
        isPublic: Boolean(b.isPublic),
        visibility: b.visibility ?? 'public',
        createdAt: (b.createdAt as Date)?.toISOString?.() ?? null,
        slug: b.slug ?? '',
        primaryColor,
        avatarEmoji,
        imageUrl,
        shortDescription,
        activeOrigins,
        leadCaptureEnabled,
        totalConversations: stats?.totalConversations ?? 0,
        totalMessages: stats?.totalMessages ?? 0,
        knowledgeDocs: stats?.knowledgeDocs ?? 0,
        knowledgeFaqs: stats?.knowledgeFaqs ?? 0,
        knowledgeSnippets: stats?.knowledgeSnippets ?? 0,
        knowledgeDatasheets: stats?.knowledgeDatasheets ?? 0,
        lastActivityAt: stats?.lastActivityAt ?? null,
        lastTrainedAt: stats?.lastTrainedAt ?? null,
        isPlatformBot: (b as { isPlatformBot?: boolean }).isPlatformBot === true,
        platformBotType:
          typeof (b as { platformBotType?: unknown }).platformBotType === 'string'
            ? (b as { platformBotType: string }).platformBotType
            : undefined,
      };
    });
  }

  /**
   * Deletes multiple agents-pack bots in one request. Each id uses the same cascade as DELETE :id
   * (conversations, messages, documents, knowledge, jobs, etc.). Partial success returns 200 with `failed` entries.
   */
  @Post('bulk-delete')
  async bulkDeleteBots(@Body() body: { ids?: unknown }, @Req() req: RequestWithUser) {
    const raw = body?.ids;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new HttpException({ error: 'ids must be a non-empty array' }, HttpStatus.BAD_REQUEST);
    }
    const MAX = 50;
    if (raw.length > MAX) {
      throw new HttpException({ error: `At most ${MAX} agents per request` }, HttpStatus.BAD_REQUEST);
    }
    const uniqueIds = [...new Set(raw.map((x) => String(x ?? '').trim()).filter((id) => Types.ObjectId.isValid(id)))];
    if (uniqueIds.length === 0) {
      throw new HttpException({ error: 'No valid bot ids' }, HttpStatus.BAD_REQUEST);
    }

    const deleted: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const id of uniqueIds) {
      try {
        const botDoc = await this.botsService.findByIdAny(id);
        if (!botDoc) {
          failed.push({ id, error: 'not_found' });
          continue;
        }
        const uid = req.user?._id != null ? String(req.user._id) : '';
        const ok = await this.workspacesService.canUserAccessWorkspaceBot(
          uid,
          req.user?.role ?? '',
          botDoc as Record<string, unknown>,
        );
        if (!ok) {
          failed.push({ id, error: 'forbidden' });
          continue;
        }
        if (botIsEffectivelyDeleted(botDoc as { active?: boolean; deletedAt?: Date | null })) {
          deleted.push(id);
          continue;
        }
        if ((botDoc as { agentsPackAgent?: boolean }).agentsPackAgent !== true) {
          failed.push({ id, error: 'not_pack_agent' });
          continue;
        }
        await this.botsService.remove(id);
        deleted.push(id);
      } catch (e) {
        if (e instanceof HttpException) {
          const status = e.getStatus();
          const err =
            status === HttpStatus.FORBIDDEN
              ? 'forbidden'
              : status === HttpStatus.NOT_FOUND
                ? 'not_found'
                : `http_${status}`;
          failed.push({ id, error: err });
        } else {
          failed.push({ id, error: 'error' });
        }
      }
    }

    return { ok: true, deleted, failed };
  }

  /**
   * Single payload for admin knowledge-base polling: document health, KB embedding snapshot,
   * and the current page of documents (same shape as GET .../documents).
   */
  @Get(':id/knowledge-poll')
  async getKnowledgePoll(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanAccessWorkspaceBot(req, id);
    const bot = await this.botsService.findOneWorkspaceForAdmin(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
    }
    const safePage = Math.max(1, Number(page ?? 1) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit ?? 10) || 10));

    const [health, embedding, { documents, total }] = await Promise.all([
      this.documentsService.getHealthSummary(id),
      this.knowledgeBaseItemService.getKnowledgeStatusForBot(id),
      this.documentsService.findByBotPaginated(id, safePage, safeLimit),
    ]);

    return {
      ok: true,
      health,
      embedding,
      documents,
      total,
      counts: {
        total: health.docsTotal ?? 0,
        pending: health.docsPending ?? 0,
        queued: health.docsQueued ?? 0,
        processing: health.docsProcessing ?? 0,
        ready: health.docsReady ?? 0,
        failed: health.docsFailed ?? 0,
      },
      lastIngestedAt: health.lastIngestedAt,
      lastFailedDoc: health.lastFailedDoc,
    };
  }

  private static readonly AVATAR_MAX_BYTES = 2 * 1024 * 1024;
  private static readonly AVATAR_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

  /**
   * Multipart avatar upload (field `file`). Stores in the public asset bucket and returns HTTPS URL for PATCH `imageUrl` + `avatarSource: upload`.
   */
  @Post(':id/avatar')
  async uploadBotAvatar(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanAccessWorkspaceBot(req, id);

    const r = req;
    if (!r.isMultipart()) {
      throw new HttpException(
        { error: 'Expected multipart/form-data with a file field named "file".' },
        HttpStatus.BAD_REQUEST,
      );
    }

    let buffer: Buffer | null = null;
    let originalName = 'avatar';
    let mime = '';

    try {
      for await (const part of r.parts()) {
        if (part.type === 'file') {
          if (part.fieldname !== 'file') {
            throw new HttpException(
              { error: 'Unexpected file field. Use field name "file".' },
              HttpStatus.BAD_REQUEST,
            );
          }
          if (buffer !== null) {
            throw new HttpException({ error: 'Only one file is allowed per request.' }, HttpStatus.BAD_REQUEST);
          }
          /** Read file buffer while iterating — deferring `toBuffer()` until after `parts()` can stall @fastify/multipart. */
          buffer = await part.toBuffer();
          originalName = (part.filename || 'avatar').trim() || 'avatar';
          mime =
            part.mimetype && part.mimetype !== 'application/octet-stream'
              ? part.mimetype.toLowerCase()
              : '';
        } else if (part.type === 'field') {
          void String((part as { value?: unknown }).value ?? '');
        }
      }
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const err = e as { statusCode?: number; code?: string; message?: string };
      if (err.statusCode === 413 || String(err.code ?? '').includes('FILE_TOO_LARGE')) {
        throw new HttpException(
          { error: 'File too large', maxBytes: WorkspaceBotsControllerBase.AVATAR_MAX_BYTES },
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      throw new HttpException({ error: 'Upload failed' }, HttpStatus.BAD_REQUEST);
    }

    if (!buffer?.length) {
      throw new HttpException(
        { error: 'Missing file. Send multipart field "file".' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!mime || !WorkspaceBotsControllerBase.AVATAR_ALLOWED_TYPES.has(mime)) {
      throw new HttpException(
        { error: 'Only PNG, JPG, and WebP images are allowed for avatars.' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!buffer.length || buffer.length > WorkspaceBotsControllerBase.AVATAR_MAX_BYTES) {
      throw new HttpException(
        { error: 'Image must be under 2MB.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const uploaded = await uploadPublic({
        prefix: `uploads/bot-avatars/${id}`,
        originalName,
        contentType: mime,
        body: buffer,
      });
      return { ok: true as const, url: uploaded.url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[workspace-bots] avatar S3 upload failed', { id, msg });
      throw new HttpException(
        { error: 'Avatar storage is not available. Try again later.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get(':id')
  async getBot(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanAccessWorkspaceBot(req, id);
    const bot = await this.botsService.findOneWorkspaceForAdmin(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
    }
    const health = await this.documentsService.getHealthSummary(id);
    const listStats = await this.botsService.getListStatsForBots([id]);
    const lastTrainedAt = listStats.get(id)?.lastTrainedAt ?? null;
    const b = bot as Record<string, unknown>;
    const rawSnippets = Array.isArray((b as { knowledgeSnippets?: unknown }).knowledgeSnippets)
      ? (b as { knowledgeSnippets: Array<{ title?: unknown; snippet?: unknown; description?: unknown; active?: unknown }> })
          .knowledgeSnippets
      : [];
    const rawFaqsForTraining = Array.isArray(b.faqs) ? (b.faqs as Array<Record<string, unknown>>) : [];
    const rawSheets = Array.isArray((b as { knowledgeDatasheets?: unknown }).knowledgeDatasheets)
      ? (b as { knowledgeDatasheets: unknown[] }).knowledgeDatasheets
      : Array.isArray((b as { knowledgeTables?: unknown }).knowledgeTables)
        ? (b as { knowledgeTables: unknown[] }).knowledgeTables
        : [];
    const parsedExampleQuestions = parseExampleQuestionsFromDoc((b as { exampleQuestions?: unknown }).exampleQuestions);
    const [snippetTraining, faqTraining, tableTraining, suggestionTraining, knowledgeUsage] = await Promise.all([
      this.knowledgeBaseItemService.getIndexedSnippetTraining(id, rawSnippets.length),
      this.knowledgeBaseItemService.getIndexedFaqTraining(id, rawFaqsForTraining.length),
      this.knowledgeBaseItemService.getIndexedTableTraining(id, rawSheets.length),
      this.knowledgeBaseItemService.getIndexedSuggestionTraining(id, parsedExampleQuestions.length),
      (async () => {
        const usageBreakdown = await this.knowledgeUsageService.getActiveBotKnowledgeUsage(id, b as Record<string, unknown>);
        return knowledgeUsageBreakdownToApiPayload(usageBreakdown);
      })(),
    ]);
    return {
      ok: true,
      bot: {
        id: String(b._id),
        slug: (b.slug as string) ?? '',
        agentsPackAgent: Boolean((b as { agentsPackAgent?: boolean }).agentsPackAgent),
        name: b.name ?? '',
        shortDescription: b.shortDescription ?? '',
        description: b.description ?? '',
        category: b.category ?? '',
        categories: b.categories ?? [],
        imageUrl: b.imageUrl ?? '',
        avatarEmoji: typeof b.avatarEmoji === 'string' ? b.avatarEmoji : '',
        avatarSource: workspaceAvatarSource(b),
        openaiApiKeyOverride: b.openaiApiKeyOverride ?? '',
        whisperApiKeyOverride: b.whisperApiKeyOverride ?? '',
        welcomeMessage: b.welcomeMessage ?? '',
        welcomeMessageEnabled: (b as { welcomeMessageEnabled?: boolean }).welcomeMessageEnabled !== false,
        knowledgeDescription: (b.knowledgeDescription as string) ?? '',
        knowledgeSnippets: rawSnippets
          .map((s, originalIndex) => ({ s, originalIndex }))
          .map(({ s, originalIndex }) => {
            const t = snippetTraining[originalIndex];
            return {
              title: String(s?.title ?? '').trim() || 'Snippet',
              snippet: String(s?.snippet ?? s?.description ?? '').trim(),
              active: t ? t.active !== false : (s as { active?: unknown }).active !== false,
              snippetIndex: originalIndex,
              ...(t
                ? {
                    trainingStatus: t.trainingStatus,
                    lastTrainedAt: t.lastTrainedAt,
                    knowledgeItemId: t.knowledgeItemId,
                  }
                : {}),
            };
          }),
        knowledgeDatasheets: rawSheets.map((raw, i) => {
          const t = tableTraining[i];
          const base = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
          return {
            ...base,
            active: t ? t.active !== false : (base as { active?: unknown }).active !== false,
            tableIndex: i,
            ...(t
              ? {
                  trainingStatus: t.trainingStatus,
                  lastTrainedAt: t.lastTrainedAt,
                  importFileSize: t.importFileSize,
                  importFileName: t.importFileName,
                  knowledgeItemId: t.knowledgeItemId,
                  importDisplayState: (t as { importDisplayState?: string }).importDisplayState,
                }
              : {}),
          };
        }),
        status: b.status === 'published' ? 'published' : 'draft',
        isPublic: Boolean(b.isPublic),
        leadCapture: b.leadCapture ?? undefined,
        chatUI: b.chatUI ?? undefined,
        faqs: rawFaqsForTraining
          .map((faq, originalIndex) => ({ faq, originalIndex }))
          .map(({ faq, originalIndex }) => {
            const questions = Array.isArray(faq.questions) ? (faq.questions as unknown[]).map((q) => String(q ?? '')) : [];
            const q0 = String(faq.question ?? '').trim();
            const mergedQs = questions.length > 0 ? questions : q0 ? [q0] : [];
            const t = faqTraining[originalIndex];
            return {
              title: String(faq.title ?? '').trim(),
              questions: mergedQs,
              question: mergedQs[0] ?? q0,
              answer: String(faq.answer ?? '').trim(),
              active: t ? t.active !== false : faq?.active !== false,
              faqIndex: originalIndex,
              ...(t
                ? {
                    trainingStatus: t.trainingStatus,
                    lastTrainedAt: t.lastTrainedAt,
                    knowledgeItemId: t.knowledgeItemId,
                  }
                : {}),
            };
          }),
        exampleQuestions: parsedExampleQuestions.map((q, i) => {
          const t = suggestionTraining[i];
          return {
            label: q.label,
            ...(q.context ? { context: q.context } : {}),
            active: t ? t.active !== false : q.active !== false,
            suggestionIndex: i,
            ...(q.hideChipTextInChat === true ? { hideChipTextInChat: true } : {}),
            ...(t
              ? {
                  trainingStatus: t.trainingStatus,
                  lastTrainedAt: t.lastTrainedAt,
                  knowledgeItemId: t.knowledgeItemId,
                }
              : {}),
          };
        }),
        personality: b.personality ?? {},
        config: b.config ?? {},
        translationSettings:
          (b as { translationSettings?: unknown }).translationSettings ?? {
            enabled: false,
            mode: 'english_only',
            transcriptLanguage: 'english',
          },
        limitOverrideMessages: typeof b.limitOverrideMessages === 'number' ? b.limitOverrideMessages : undefined,
        visibility:
          b.visibility === 'private' || b.visibility === 'public'
            ? b.visibility
            : 'public',
        accessKey:
          typeof b.accessKey === 'string' ? b.accessKey : '',
        secretKey:
          typeof b.secretKey === 'string' ? b.secretKey : '',
        ownerId: b.ownerId != null ? String(b.ownerId) : undefined,
        visitorMultiChatEnabled: (b as { visitorMultiChatEnabled?: boolean }).visitorMultiChatEnabled === true,
        visitorMultiChatMax:
          typeof (b as { visitorMultiChatMax?: unknown }).visitorMultiChatMax === 'number' &&
          Number.isFinite((b as { visitorMultiChatMax: number }).visitorMultiChatMax)
            ? Math.floor((b as { visitorMultiChatMax: number }).visitorMultiChatMax)
            : null,
        knowledgeReplyPriority: normalizeKnowledgeReplyPrioritySettings(
          (b as { knowledgeReplyPriority?: unknown }).knowledgeReplyPriority,
        ),
        includeNameInKnowledge: Boolean(b.includeNameInKnowledge),
        includeTaglineInKnowledge: Boolean(b.includeTaglineInKnowledge),
        includeNotesInKnowledge: (b.includeNotesInKnowledge as boolean | undefined) !== false,
        allowedOrigins: Array.isArray(b.allowedOrigins)
          ? (b.allowedOrigins as Array<{ origin?: unknown; label?: unknown; isActive?: unknown }>).map((row) => ({
            origin: String(row?.origin ?? '').trim(),
            ...(typeof row?.label === 'string' && row.label.trim() ? { label: row.label.trim() } : {}),
            isActive: row?.isActive !== false,
          })).filter((r) => r.origin)
          : [],
        workspaceId: b.workspaceId != null ? String(b.workspaceId) : undefined,
        shareChat: (() => {
          const sc = (b as { shareChat?: Record<string, unknown> }).shareChat;
          if (!sc || typeof sc !== 'object') {
            return {
              enabled: false,
              slug: '',
              expiresAt: null as string | null,
              allowDraft: false,
              requiresPreviewToken: true,
              secureSharePreviewConfigured: false,
            };
          }
          const exp = sc.expiresAt;
          const hasHash = sharePreviewTokenHashLooksSet(sc.tokenHash);
          const expMs = sharePreviewExpiresAtMs({ expiresAt: sc.expiresAt });
          const shareRevoked =
            sc.tokenRevokedAt instanceof Date ||
            (typeof sc.tokenRevokedAt === 'string' && String(sc.tokenRevokedAt).trim() !== '');
          const secureSharePreviewConfigured = hasHash && expMs != null && !shareRevoked;
          const tr = sc.tokenRevokedAt;
          const tokenRevokedAt =
            tr instanceof Date
              ? tr.toISOString()
              : typeof tr === 'string' && tr.trim()
                ? tr.trim()
                : null;
          return {
            enabled: sc.enabled === true,
            slug: typeof sc.slug === 'string' ? sc.slug : '',
            expiresAt:
              exp instanceof Date
                ? exp.toISOString()
                : typeof exp === 'string'
                  ? exp
                  : null,
            allowDraft: sc.allowDraft === true,
            requiresPreviewToken: true,
            secureSharePreviewConfigured,
            tokenRevokedAt,
          };
        })(),
        ...(typeof (b as { clientDraftId?: unknown }).clientDraftId === 'string' &&
        String((b as { clientDraftId: string }).clientDraftId).trim() !== ''
          ? {         clientDraftId: String((b as { clientDraftId: string }).clientDraftId).trim() }
          : {}),
        lastTrainedAt,
        knowledgeUsage,
      },
      health,
    };
  }

  @Patch(':id')
  async patchBot(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanAccessWorkspaceBot(req, id);
    const botForType = await this.botsService.findOneWorkspaceForAdmin(id);
    if (!botForType) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
    }
    let patch;
    try {
      patch = normalizeWorkspaceBotPatch(body);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const normMsg = e instanceof Error ? e.message : String(e);
      if (normMsg.includes('exceeds the maximum stored content size')) {
        throw new HttpException({ error: normMsg }, HttpStatus.BAD_REQUEST);
      }
      throw e instanceof Error ? e : new HttpException({ error: 'Invalid payload' }, HttpStatus.BAD_REQUEST);
    }
    if (patch.touched.has('allowedOrigins') && patch.allowedOrigins !== undefined) {
      assertAllowedOriginsPolicy(patch.allowedOrigins.length, req.user?.role);
    }
    try {
      return await this.botsService.updateWorkspaceBot(id, patch);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'Update failed';
      if (msg === 'Bot not found')
        throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
      if (
        msg.includes('Name is required') ||
        msg.includes('Description is required') ||
        msg.includes('allowed origin') ||
        msg.includes('allowed embed origin') ||
        msg.includes('Localhost and loopback')
      ) {
        throw new HttpException({ error: msg }, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':id/access-settings')
  async patchAccessSettings(
    @Param('id') id: string,
    @Body()
    body: {
      visibility?: unknown;
      visitorMultiChatEnabled?: unknown;
      visitorMultiChatMax?: unknown;
    },
    @Req() req: RequestWithUser,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanAccessWorkspaceBot(req, id);
    const visibility = body?.visibility === 'private' ? 'private' : body?.visibility === 'public' ? 'public' : null;
    if (!visibility) {
      throw new HttpException({ error: 'visibility must be public or private.' }, HttpStatus.BAD_REQUEST);
    }
    const visitorMultiChatEnabled = body?.visitorMultiChatEnabled === true;
    const rawVisitorMax = body?.visitorMultiChatMax;
    const visitorMultiChatMax = normalizeVisitorMultiChatMax(rawVisitorMax);
    try {
      return await this.botsService.updateWorkspaceAccessSettings(id, {
        visibility,
        visitorMultiChatEnabled,
        visitorMultiChatMax: visitorMultiChatEnabled ? visitorMultiChatMax : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      if (msg === 'Bot not found')
        throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/rotate-access-key')
  async rotateAccessKey(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessWorkspaceBot(req, id);
    try {
      return await this.botsService.rotateWorkspaceAccessKey(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rotate failed';
      if (msg === 'Bot not found')
        throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/rotate-secret-key')
  async rotateSecretKey(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessWorkspaceBot(req, id);
    try {
      return await this.botsService.rotateWorkspaceSecretKey(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rotate failed';
      if (msg === 'Bot not found')
        throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id/embedding-status')
  async getEmbeddingStatus(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessWorkspaceBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
    }
    return this.knowledgeBaseItemService.getKnowledgeStatusForBot(id);
  }

  @Post(':id/embed/retry-faq')
  async retryFaqEmbedding(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessWorkspaceBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
    }
    await this.knowledgeBaseItemService.markTrainableSourceTypesForRetrain(id, ['faq']);
    return {
      ok: true,
      message: 'Q&A training queued; embeddings run in the background worker.',
      queued: true,
      /** Present for backward compatibility; actual counts are unknown until the job runs. */
      updated: 0,
      skipped: 0,
    };
  }

  @Post(':id/embed/retry-note')
  async retryNoteEmbedding(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessWorkspaceBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
    }
    await this.knowledgeBaseItemService.markTrainableSourceTypesForRetrain(id, ['note']);
    return {
      ok: true,
      message: 'Snippet training queued; embeddings run in the background worker.',
      queued: true,
      chunksUpdated: 0,
    };
  }

  @Post(':id/embed/retry-table')
  async retryTableEmbedding(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessWorkspaceBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
    }
    await this.knowledgeBaseItemService.markTrainableSourceTypesForRetrain(id, ['table']);
    return {
      ok: true,
      message: 'Table training queued; embeddings run in the background worker.',
      queued: true,
      updated: 0,
      skipped: 0,
    };
  }

  @Delete(':id')
  async deleteBot(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    const botDoc = await this.botsService.findByIdAny(id);
    if (!botDoc) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(
      uid,
      req.user?.role ?? '',
      botDoc as Record<string, unknown>,
    );
    if (!ok) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }
    if (botIsEffectivelyDeleted(botDoc as { active?: boolean; deletedAt?: Date | null })) {
      return { ok: true, deleted: id, alreadyDeleted: true };
    }
    await this.botsService.remove(id);
    return { ok: true, deleted: id };
  }
}
