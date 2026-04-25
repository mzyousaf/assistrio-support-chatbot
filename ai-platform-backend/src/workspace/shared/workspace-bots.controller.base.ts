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
import { KnowledgeBaseChunkService } from '../../knowledge/knowledge-base-chunk.service';
import { normalizeBotPayload, normalizeWorkspaceBotPatch } from './bot-payload';
import { assertAllowedOriginsPolicy } from './allowed-origins-policy';
import { BotOnboardingService } from './bot-onboarding.service';
import type { RequestUser } from '../../auth/shared/request-user.types';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { uploadPublic } from '../../lib/s3';

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
    private readonly botOnboardingService: BotOnboardingService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
    private readonly workspacesService: WorkspacesService,
  ) { }

  protected async assertCanAccessWorkspaceBot(req: RequestWithUser, botId: string): Promise<void> {
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
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
        msg.includes('allowed embed origin')
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
        messageLimitMode: b.messageLimitMode ?? 'none',
        messageLimitTotal:
          typeof b.messageLimitTotal === 'number' ? b.messageLimitTotal : null,
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
        lastActivityAt: stats?.lastActivityAt ?? null,
        lastTrainedAt: stats?.lastTrainedAt ?? null,
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
        await this.assertCanAccessWorkspaceBot(req, id);
        const bot = await this.botsService.findOne(id);
        if (!bot) {
          failed.push({ id, error: 'not_found' });
          continue;
        }
        if ((bot as { agentsPackAgent?: boolean }).agentsPackAgent !== true) {
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
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
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
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const health = await this.documentsService.getHealthSummary(id);
    const listStats = await this.botsService.getListStatsForBots([id]);
    const lastTrainedAt = listStats.get(id)?.lastTrainedAt ?? null;
    const b = bot as Record<string, unknown>;
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
        status: b.status === 'published' ? 'published' : 'draft',
        isPublic: Boolean(b.isPublic),
        leadCapture: b.leadCapture ?? undefined,
        chatUI: b.chatUI ?? undefined,
        faqs: (Array.isArray(b.faqs) ? (b.faqs as Array<{ question?: unknown; answer?: unknown; active?: unknown }>) : [])
          .filter((faq) => (faq as { active?: unknown }).active !== false)
          .map((faq) => ({
            question: String(faq?.question ?? ''),
            answer: String(faq?.answer ?? ''),
            active: true,
          })),
        exampleQuestions: Array.isArray(b.exampleQuestions)
          ? (b.exampleQuestions as string[]).map((q) => String(q ?? '').trim()).filter(Boolean)
          : [],
        personality: b.personality ?? {},
        config: b.config ?? {},
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
        messageLimitMode:
          b.messageLimitMode === 'fixed_total' ? 'fixed_total' : 'none',
        messageLimitTotal:
          typeof b.messageLimitTotal === 'number' ? b.messageLimitTotal : null,
        messageLimitUpgradeMessage:
          typeof b.messageLimitUpgradeMessage === 'string'
            ? b.messageLimitUpgradeMessage
            : null,
        visitorMultiChatEnabled: (b as { visitorMultiChatEnabled?: boolean }).visitorMultiChatEnabled === true,
        visitorMultiChatMax:
          typeof (b as { visitorMultiChatMax?: unknown }).visitorMultiChatMax === 'number' &&
          Number.isFinite((b as { visitorMultiChatMax: number }).visitorMultiChatMax)
            ? Math.floor((b as { visitorMultiChatMax: number }).visitorMultiChatMax)
            : null,
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
        ...(typeof (b as { clientDraftId?: unknown }).clientDraftId === 'string' &&
        String((b as { clientDraftId: string }).clientDraftId).trim() !== ''
          ? { clientDraftId: String((b as { clientDraftId: string }).clientDraftId).trim() }
          : {}),
        lastTrainedAt,
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
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const patch = normalizeWorkspaceBotPatch(body);
    if (patch.touched.has('allowedOrigins') && patch.allowedOrigins !== undefined) {
      assertAllowedOriginsPolicy(patch.allowedOrigins.length, req.user?.role);
    }
    try {
      return await this.botsService.updateWorkspaceBot(id, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      if (msg === 'Bot not found') throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      if (
        msg.includes('Name is required') ||
        msg.includes('Description is required') ||
        msg.includes('messageLimitTotal must be a positive integer') ||
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
      messageLimitMode?: unknown;
      messageLimitTotal?: unknown;
      messageLimitUpgradeMessage?: unknown;
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
    const messageLimitMode =
      body?.messageLimitMode === 'fixed_total'
        ? 'fixed_total'
        : body?.messageLimitMode === 'none'
          ? 'none'
          : null;
    if (!visibility) {
      throw new HttpException({ error: 'visibility must be public or private.' }, HttpStatus.BAD_REQUEST);
    }
    if (!messageLimitMode) {
      throw new HttpException({ error: 'messageLimitMode must be none or fixed_total.' }, HttpStatus.BAD_REQUEST);
    }
    const messageLimitTotal =
      body?.messageLimitTotal == null
        ? null
        : typeof body.messageLimitTotal === 'number' && Number.isFinite(body.messageLimitTotal)
          ? Math.floor(body.messageLimitTotal)
          : Number.isFinite(Number(body.messageLimitTotal))
            ? Math.floor(Number(body.messageLimitTotal))
            : null;
    if (messageLimitMode === 'fixed_total' && (!messageLimitTotal || messageLimitTotal <= 0)) {
      throw new HttpException(
        { error: 'messageLimitTotal must be a positive integer when messageLimitMode is fixed_total.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const messageLimitUpgradeMessage =
      typeof body?.messageLimitUpgradeMessage === 'string'
        ? body.messageLimitUpgradeMessage.trim() || null
        : null;
    const visitorMultiChatEnabled = body?.visitorMultiChatEnabled === true;
    const rawVisitorMax = body?.visitorMultiChatMax;
    const visitorMultiChatMax = normalizeVisitorMultiChatMax(rawVisitorMax);
    try {
      return await this.botsService.updateWorkspaceAccessSettings(id, {
        visibility,
        messageLimitMode,
        messageLimitTotal,
        messageLimitUpgradeMessage,
        visitorMultiChatEnabled,
        visitorMultiChatMax: visitorMultiChatEnabled ? visitorMultiChatMax : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      if (msg === 'Bot not found') throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      if (msg.includes('messageLimitTotal must be a positive integer')) {
        throw new HttpException({ error: msg }, HttpStatus.BAD_REQUEST);
      }
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
      if (msg === 'Bot not found') throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
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
      if (msg === 'Bot not found') throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id/embedding-status')
  async getEmbeddingStatus(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessWorkspaceBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    return this.knowledgeBaseItemService.getKnowledgeStatusForBot(id);
  }

  @Post(':id/embed/retry-faq')
  async retryFaqEmbedding(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessWorkspaceBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const result = await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(id);
    return { ok: true, message: 'FAQ knowledge base chunks refreshed.', updated: result.updated, skipped: result.skipped };
  }

  @Post(':id/embed/retry-note')
  async retryNoteEmbedding(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessWorkspaceBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const count = await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(id);
    return { ok: true, message: 'Note knowledge base chunks refreshed.', chunksUpdated: count };
  }

  @Delete(':id')
  async deleteBot(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessWorkspaceBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot) throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    await this.botsService.remove(id);
    return { ok: true, deleted: id };
  }
}
