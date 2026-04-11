import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { BotsService } from '../bots/bots.service';
import { normalizeVisitorMultiChatMax } from '../bots/visitor-multi-chat.util';
import { DocumentsService } from '../documents/documents.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { normalizeBotPayload } from './bot-payload';
import { assertAllowedDomainsPolicy } from './allowed-domains-policy';
import { BotOnboardingService } from './bot-onboarding.service';
import { AuthGuard, type RequestUser } from '../auth/auth.guard';
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Controller('api/user/bots')
@UseGuards(AuthGuard)
export class UserBotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
    private readonly botOnboardingService: BotOnboardingService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
    private readonly workspacesService: WorkspacesService,
  ) { }

  private async assertCanAccessShowcaseBot(req: RequestWithUser, botId: string): Promise<void> {
    const bot = await this.botsService.findOne(botId);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessShowcaseBot(uid, req.user?.role ?? '', bot as Record<string, unknown>);
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
    const draftBot = await this.botsService.findShowcaseByClientDraftId(clientDraftId);
    if (draftBot?._id != null) {
      await this.assertCanAccessShowcaseBot(req, String(draftBot._id));
    }
    const creatorTypeForPayload =
      draftBot && (draftBot as { creatorType?: string }).creatorType === 'visitor' ? 'visitor' : 'user';
    const normalized = normalizeBotPayload(body?.payload ?? {}, { creatorType: creatorTypeForPayload });
    if (normalized.allowedDomains !== undefined) {
      assertAllowedDomainsPolicy(normalized.allowedDomains, req.user?.role);
    }
    const createdByUserId = req.user?._id != null ? String(req.user._id) : undefined;
    try {
      return await this.botsService.finalizeDraft(clientDraftId, normalized, createdByUserId);
    } catch (err) {
      console.error('Finalize draft bot failed', err);
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.includes('allowed domain') ||
        msg.includes('allowed embed domain') ||
        msg.includes('platform visitor allowlist') ||
        msg.includes('platform visitor website') ||
        msg.includes('At most one platform visitor website') ||
        msg.includes('Trial bots may have at most one allowed embed domain')
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
    return (bots as Record<string, unknown>[]).map((b) => {
      const chatUI =
        b.chatUI && typeof b.chatUI === 'object' ? (b.chatUI as Record<string, unknown>) : {};
      const rawPrimary = typeof chatUI.primaryColor === 'string' ? chatUI.primaryColor.trim() : '';
      const primaryColor = /^#[0-9a-fA-F]{6}$/.test(rawPrimary) ? rawPrimary : '#14B8A6';
      const avatarEmoji =
        typeof b.avatarEmoji === 'string' && b.avatarEmoji.trim() !== '' ? b.avatarEmoji.trim() : undefined;
      const imageUrl =
        typeof b.imageUrl === 'string' && b.imageUrl.trim() !== '' ? b.imageUrl.trim() : undefined;
      return {
        _id: String(b._id),
        name: b.name ?? '',
        type: b.type ?? 'showcase',
        category: b.category ?? '',
        status: b.status ?? 'draft',
        isPublic: Boolean(b.isPublic),
        visibility: b.visibility ?? 'public',
        creatorType: b.creatorType ?? 'user',
        messageLimitMode: b.messageLimitMode ?? 'none',
        messageLimitTotal:
          typeof b.messageLimitTotal === 'number' ? b.messageLimitTotal : null,
        createdAt: (b.createdAt as Date)?.toISOString?.() ?? null,
        slug: b.slug ?? '',
        primaryColor,
        avatarEmoji,
        imageUrl,
      };
    });
  }

  /**
   * Deletes multiple showcase bots in one request. Each id uses the same cascade as DELETE :id
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
        await this.assertCanAccessShowcaseBot(req, id);
        const bot = await this.botsService.findOne(id);
        if (!bot) {
          failed.push({ id, error: 'not_found' });
          continue;
        }
        if ((bot as { type?: string }).type !== 'showcase') {
          failed.push({ id, error: 'not_showcase' });
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
    await this.assertCanAccessShowcaseBot(req, id);
    const bot = await this.botsService.findOneShowcaseForAdmin(id);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
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

  @Get(':id')
  async getBot(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    await this.assertCanAccessShowcaseBot(req, id);
    const bot = await this.botsService.findOneShowcaseForAdmin(id);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const health = await this.documentsService.getHealthSummary(id);
    const b = bot as Record<string, unknown>;
    return {
      ok: true,
      bot: {
        id: String(b._id),
        slug: (b.slug as string) ?? '',
        type: (b.type as string) ?? 'showcase',
        name: b.name ?? '',
        shortDescription: b.shortDescription ?? '',
        description: b.description ?? '',
        category: b.category ?? '',
        categories: b.categories ?? [],
        imageUrl: b.imageUrl ?? '',
        openaiApiKeyOverride: b.openaiApiKeyOverride ?? '',
        whisperApiKeyOverride: b.whisperApiKeyOverride ?? '',
        welcomeMessage: b.welcomeMessage ?? '',
        knowledgeDescription: (b.knowledgeDescription as string) ?? '',
        status: b.status === 'published' ? 'published' : 'draft',
        isPublic: Boolean(b.isPublic),
        leadCapture: b.leadCapture ?? undefined,
        chatUI: b.chatUI ?? undefined,
        faqs: Array.isArray(b.faqs)
          ? (b.faqs as Array<{ question?: unknown; answer?: unknown; active?: unknown }>).map((faq) => ({
            question: String(faq?.question ?? ''),
            answer: String(faq?.answer ?? ''),
            active: faq?.active !== false,
          }))
          : [],
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
        creatorType:
          b.creatorType === 'visitor' ? 'visitor' : 'user',
        ownerUserId:
          b.ownerUserId != null ? String(b.ownerUserId) : undefined,
        ownerVisitorId:
          typeof b.ownerVisitorId === 'string' ? b.ownerVisitorId : undefined,
        messageLimitMode:
          b.messageLimitMode === 'fixed_total' ? 'fixed_total' : 'none',
        messageLimitTotal:
          typeof b.messageLimitTotal === 'number' ? b.messageLimitTotal : null,
        messageLimitUpgradeMessage:
          typeof b.messageLimitUpgradeMessage === 'string'
            ? b.messageLimitUpgradeMessage
            : null,
        includeNameInKnowledge: Boolean(b.includeNameInKnowledge),
        includeTaglineInKnowledge: Boolean(b.includeTaglineInKnowledge),
        includeNotesInKnowledge: (b.includeNotesInKnowledge as boolean | undefined) !== false,
        allowedDomains: Array.isArray(b.allowedDomains)
          ? (b.allowedDomains as unknown[]).map((d) => String(d ?? '').trim()).filter(Boolean)
          : [],
        websiteURLAllowlist: Array.isArray(b.websiteURLAllowlist)
          ? (b.websiteURLAllowlist as Array<{ platformVisitorId?: unknown; websiteUrl?: unknown }>).map(
            (e) => ({
              platformVisitorId: String(e?.platformVisitorId ?? '').trim(),
              websiteUrl: String(e?.websiteUrl ?? '').trim(),
            }),
          ).filter((e) => e.platformVisitorId && e.websiteUrl)
          : [],
        workspaceId: b.workspaceId != null ? String(b.workspaceId) : undefined,
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
    await this.assertCanAccessShowcaseBot(req, id);
    const botForType = await this.botsService.findOneShowcaseForAdmin(id);
    if (!botForType) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const creatorTypeForPayload =
      (botForType as { creatorType?: string }).creatorType === 'visitor' ? 'visitor' : 'user';
    const normalized = normalizeBotPayload(body, { creatorType: creatorTypeForPayload });
    if (normalized.allowedDomains !== undefined) {
      assertAllowedDomainsPolicy(normalized.allowedDomains, req.user?.role);
    }
    try {
      return await this.botsService.updateShowcase(id, {
        name: normalized.name,
        shortDescription: normalized.shortDescription,
        description: normalized.description,
        categories: normalized.categories,
        imageUrl: normalized.imageUrl,
        avatarEmoji: normalized.avatarEmoji,
        openaiApiKeyOverride: normalized.openaiApiKeyOverride,
        whisperApiKeyOverride: normalized.whisperApiKeyOverride,
        welcomeMessage: normalized.welcomeMessage,
        knowledgeDescription: normalized.knowledgeDescription,
        leadCapture: normalized.leadCapture,
        chatUI: normalized.chatUI,
        faqs: normalized.faqs,
        exampleQuestions: normalized.exampleQuestions,
        personality: normalized.personality,
        config: normalized.config,
        limitOverrideMessages: normalized.limitOverrideMessages,
        visibility: normalized.visibility,
        messageLimitMode: normalized.messageLimitMode,
        messageLimitTotal: normalized.messageLimitTotal,
        messageLimitUpgradeMessage: normalized.messageLimitUpgradeMessage,
        isPublic: normalized.isPublic,
        status: normalized.status,
        includeNameInKnowledge: normalized.includeNameInKnowledge,
        includeTaglineInKnowledge: normalized.includeTaglineInKnowledge,
        includeNotesInKnowledge: normalized.includeNotesInKnowledge,
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      if (msg === 'Bot not found') throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      if (
        msg.includes('Name is required') ||
        msg.includes('Description is required') ||
        msg.includes('messageLimitTotal must be a positive integer') ||
        msg.includes('allowed domain') ||
        msg.includes('allowed embed domain') ||
        msg.includes('Localhost and loopback') ||
        msg.includes('platform visitor allowlist') ||
        msg.includes('platform visitor website') ||
        msg.includes('At most one platform visitor website') ||
        msg.includes('Trial bots may have at most one allowed embed domain')
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
    await this.assertCanAccessShowcaseBot(req, id);
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
      return await this.botsService.updateShowcaseAccessSettings(id, {
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
    await this.assertCanAccessShowcaseBot(req, id);
    try {
      return await this.botsService.rotateShowcaseAccessKey(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rotate failed';
      if (msg === 'Bot not found') throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/rotate-secret-key')
  async rotateSecretKey(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessShowcaseBot(req, id);
    try {
      return await this.botsService.rotateShowcaseSecretKey(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rotate failed';
      if (msg === 'Bot not found') throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id/embedding-status')
  async getEmbeddingStatus(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessShowcaseBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    return this.knowledgeBaseItemService.getKnowledgeStatusForBot(id);
  }

  @Post(':id/embed/retry-faq')
  async retryFaqEmbedding(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessShowcaseBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const result = await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(id);
    return { ok: true, message: 'FAQ knowledge base chunks refreshed.', updated: result.updated, skipped: result.skipped };
  }

  @Post(':id/embed/retry-note')
  async retryNoteEmbedding(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessShowcaseBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const count = await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(id);
    return { ok: true, message: 'Note knowledge base chunks refreshed.', chunksUpdated: count };
  }

  @Delete(':id')
  async deleteBot(@Param('id') id: string, @Req() req: RequestWithUser) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    await this.assertCanAccessShowcaseBot(req, id);
    const bot = await this.botsService.findOne(id);
    if (!bot) throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    if ((bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Only showcase bots can be deleted here' }, HttpStatus.BAD_REQUEST);
    }
    await this.botsService.remove(id);
    return { ok: true, deleted: id };
  }
}
