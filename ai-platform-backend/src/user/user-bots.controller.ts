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
import { DocumentsService } from '../documents/documents.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { normalizeBotPayload } from './bot-payload';
import { BotOnboardingService } from './bot-onboarding.service';
import { AuthGuard, type RequestUser } from '../auth/auth.guard';

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
  ) { }

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
    const normalized = normalizeBotPayload(body?.payload ?? {});
    const createdByUserId = req.user?._id != null ? String(req.user._id) : undefined;
    try {
      return await this.botsService.finalizeDraft(clientDraftId, normalized, createdByUserId);
    } catch (err) {
      console.error('Finalize draft bot failed', err);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  async listBots(@Query('status') status?: string) {
    const filter = status === 'draft' || status === 'published' ? status : 'all';
    const bots = await this.botsService.findForAdminList(filter);
    return (bots as Record<string, unknown>[]).map((b) => ({
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
    }));
  }

  /**
   * Single payload for admin knowledge-base polling: document health, KB embedding snapshot,
   * and the current page of documents (same shape as GET .../documents).
   */
  @Get(':id/knowledge-poll')
  async getKnowledgePoll(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
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
  async getBot(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
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
      },
      health,
    };
  }

  @Patch(':id')
  async patchBot(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const normalized = normalizeBotPayload(body);
    try {
      return await this.botsService.updateShowcase(id, {
        name: normalized.name,
        shortDescription: normalized.shortDescription,
        description: normalized.description,
        categories: normalized.categories,
        imageUrl: normalized.imageUrl,
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
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      if (msg === 'Bot not found') throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      if (
        msg.includes('Name is required') ||
        msg.includes('Description is required') ||
        msg.includes('messageLimitTotal must be a positive integer')
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
    },
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
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
    try {
      return await this.botsService.updateShowcaseAccessSettings(id, {
        visibility,
        messageLimitMode,
        messageLimitTotal,
        messageLimitUpgradeMessage,
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
  async rotateAccessKey(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    try {
      return await this.botsService.rotateShowcaseAccessKey(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rotate failed';
      if (msg === 'Bot not found') throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':id/rotate-secret-key')
  async rotateSecretKey(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    try {
      return await this.botsService.rotateShowcaseSecretKey(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Rotate failed';
      if (msg === 'Bot not found') throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id/embedding-status')
  async getEmbeddingStatus(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    const bot = await this.botsService.findOne(id);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    return this.knowledgeBaseItemService.getKnowledgeStatusForBot(id);
  }

  @Post(':id/embed/retry-faq')
  async retryFaqEmbedding(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    const bot = await this.botsService.findOne(id);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const result = await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(id);
    return { ok: true, message: 'FAQ knowledge base chunks refreshed.', updated: result.updated, skipped: result.skipped };
  }

  @Post(':id/embed/retry-note')
  async retryNoteEmbedding(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    const bot = await this.botsService.findOne(id);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const count = await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(id);
    return { ok: true, message: 'Note knowledge base chunks refreshed.', chunksUpdated: count };
  }

  @Delete(':id')
  async deleteBot(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    const bot = await this.botsService.findOne(id);
    if (!bot) throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    if ((bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Only showcase bots can be deleted here' }, HttpStatus.BAD_REQUEST);
    }
    await this.botsService.remove(id);
    return { ok: true, deleted: id };
  }
}
