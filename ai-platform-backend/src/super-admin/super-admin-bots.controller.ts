import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { normalizeBotPayload } from './bot-payload';
import { SuperAdminGuard } from './super-admin.guard';

@Controller('api/super-admin/bots')
@UseGuards(SuperAdminGuard)
export class SuperAdminBotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Post('draft')
  async createDraft(@Body() body: { clientDraftId?: string }) {
    const clientDraftId = String(body?.clientDraftId ?? '').trim();
    if (!clientDraftId) {
      throw new HttpException(
        { error: 'clientDraftId is required' },
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.botsService.createDraft(clientDraftId);
    } catch (err) {
      console.error('Create draft bot failed', err);
      throw new HttpException(
        { error: 'Internal server error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('draft/finalize')
  async finalizeDraft(
    @Body() body: { clientDraftId?: string; payload?: Record<string, unknown> },
  ) {
    const clientDraftId = String(body?.clientDraftId ?? '').trim();
    if (!clientDraftId) {
      throw new HttpException(
        { error: 'clientDraftId is required' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const normalized = normalizeBotPayload(body?.payload ?? {});
    try {
      return await this.botsService.finalizeDraft(clientDraftId, normalized);
    } catch (err) {
      console.error('Finalize draft bot failed', err);
      throw new HttpException(
        { error: 'Internal server error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async listBots(@Query('status') status?: string) {
    const filter =
      status === 'draft' || status === 'published' ? status : 'all';
    const bots = await this.botsService.findForAdminList(filter);
    return (bots as Record<string, unknown>[]).map((b) => ({
      _id: String(b._id),
      name: b.name ?? '',
      type: b.type ?? 'showcase',
      category: b.category ?? '',
      status: b.status ?? 'draft',
      isPublic: Boolean(b.isPublic),
      createdAt: (b.createdAt as Date)?.toISOString?.() ?? null,
      slug: b.slug ?? '',
    }));
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
        knowledgeDescription: b.knowledgeDescription ?? '',
        status: b.status === 'published' ? 'published' : 'draft',
        isPublic: Boolean(b.isPublic),
        leadCapture: b.leadCapture ?? undefined,
        chatUI: b.chatUI ?? undefined,
        faqs: Array.isArray(b.faqs)
          ? (b.faqs as Array<{ question?: unknown; answer?: unknown }>).map((faq) => ({
              question: String(faq?.question ?? ''),
              answer: String(faq?.answer ?? ''),
            }))
          : [],
        exampleQuestions: Array.isArray(b.exampleQuestions)
          ? (b.exampleQuestions as string[]).map((q) => String(q ?? '').trim()).filter(Boolean)
          : [],
        personality: b.personality ?? {},
        config: b.config ?? {},
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
      const result = await this.botsService.updateShowcase(id, {
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
        isPublic: normalized.isPublic,
        status: normalized.status,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      if (msg === 'Bot not found') {
        throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
      }
      if (msg.includes('Name is required') || msg.includes('Description is required')) {
        throw new HttpException({ error: msg }, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}
