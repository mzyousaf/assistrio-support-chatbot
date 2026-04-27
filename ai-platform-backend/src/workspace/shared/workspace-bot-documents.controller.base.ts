import {
  Body,
  Get,
  Delete,
  Param,
  Patch,
  Post,
  Query,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { DocumentsService } from '../../documents/documents.service';
import { BotsService } from '../../bots/bots.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { IngestionService } from '../../ingestion/ingestion.service';
import type { RequestUser } from '../../auth/shared/request-user.types';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/** Shared document list/update/delete for workspace bots. */
export abstract class WorkspaceBotDocumentsControllerBase {
  constructor(
    protected readonly documentsService: DocumentsService,
    protected readonly botsService: BotsService,
    protected readonly workspacesService: WorkspacesService,
    protected readonly ingestionService: IngestionService,
  ) {}

  protected async assertBotAccess(botId: string, req: RequestWithUser): Promise<void> {
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(
      uid,
      req.user?.role ?? 'customer',
      bot as Record<string, unknown>,
    );
    if (!ok) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }
  }

  @Get()
  async list(
    @Param('botId') botId: string,
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.assertBotAccess(botId, req);
    const safePage = Math.max(1, Number(page ?? 1) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit ?? 10) || 10));

    const [{ documents, total }, health] = await Promise.all([
      this.documentsService.findByBotPaginated(botId, safePage, safeLimit),
      this.documentsService.getHealthSummary(botId),
    ]);

    return {
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

  @Post('bulk-delete')
  async bulkDelete(
    @Param('botId') botId: string,
    @Body() body: { docIds?: unknown },
    @Req() req: RequestWithUser,
  ) {
    await this.assertBotAccess(botId, req);
    const raw = body?.docIds;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new HttpException({ error: 'docIds must be a non-empty array' }, HttpStatus.BAD_REQUEST);
    }
    const MAX = 100;
    if (raw.length > MAX) {
      throw new HttpException({ error: `At most ${MAX} documents per request` }, HttpStatus.BAD_REQUEST);
    }
    const ids = [
      ...new Set(
        raw.map((x) => String(x ?? '').trim()).filter((id) => Types.ObjectId.isValid(id)),
      ),
    ];
    if (ids.length === 0) {
      throw new HttpException({ error: 'No valid document ids' }, HttpStatus.BAD_REQUEST);
    }
    for (const docId of ids) {
      await this.ingestionService.deleteJobsByDocId(botId, docId);
    }
    const deleted = await this.documentsService.removeByBotAndDocIds(botId, ids);
    return { ok: true, deleted };
  }

  @Get(':id/download-url')
  async downloadUrl(@Param('botId') botId: string, @Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertBotAccess(botId, req);
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const url = await this.documentsService.resolveFileDownloadUrlForBot(botId, id);
    if (!url) {
      throw new HttpException({ error: 'Download not available' }, HttpStatus.NOT_FOUND);
    }
    return { url };
  }

  /** One document (includes extracted `text` when ingested) for detail view. */
  @Get(':id')
  async getOne(@Param('botId') botId: string, @Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertBotAccess(botId, req);
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const doc = await this.documentsService.findOneByBotAndDoc(botId, id);
    if (!doc) {
      throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
    }
    return { document: doc as Record<string, unknown> };
  }

  @Post(':id/embed')
  async requeueIngestion(@Param('botId') botId: string, @Param('id') docId: string, @Req() req: RequestWithUser) {
    await this.assertBotAccess(botId, req);
    if (!Types.ObjectId.isValid(docId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const doc = await this.documentsService.findOneByBotAndDoc(botId, docId);
    if (!doc) {
      throw new HttpException({ error: 'Document not found' }, HttpStatus.NOT_FOUND);
    }
    await this.ingestionService.deleteJobsByDocId(botId, docId);
    await this.documentsService.setQueued(botId, docId);
    await this.ingestionService.createQueuedJob(botId, docId);
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Param('botId') botId: string, @Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertBotAccess(botId, req);
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid document id' }, HttpStatus.BAD_REQUEST);
    }
    await this.documentsService.removeByBotAndDoc(botId, id);
    return { ok: true, deleted: id };
  }

  @Patch(':id')
  async patchDocument(
    @Param('botId') botId: string,
    @Param('id') id: string,
    @Body() body: { active?: boolean; title?: string; text?: string },
    @Req() req: RequestWithUser,
  ) {
    await this.assertBotAccess(botId, req);
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid document id' }, HttpStatus.BAD_REQUEST);
    }
    const hasTitle = typeof body?.title === 'string';
    const hasText = typeof body?.text === 'string';
    if (body?.active != null && !hasTitle && !hasText) {
      await this.documentsService.setActive(botId, id, body.active !== false);
      return { ok: true };
    }
    if (hasTitle || hasText) {
      const MAX_TITLE = 500;
      const MAX_TEXT = 1_000_000;
      if (hasTitle && (body.title!.length > MAX_TITLE || !body.title!.trim())) {
        throw new HttpException(
          { error: 'Title is required and must be at most 500 characters.' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (hasText) {
        if (body.text!.length > MAX_TEXT) {
          throw new HttpException({ error: 'Text is too long.' }, HttpStatus.BAD_REQUEST);
        }
        if (!body.text!.trim()) {
          throw new HttpException({ error: 'Text cannot be empty.' }, HttpStatus.BAD_REQUEST);
        }
      }
      const doc = await this.documentsService.findOneByBotAndDoc(botId, id);
      if (!doc) {
        throw new HttpException({ error: 'Not found' }, HttpStatus.NOT_FOUND);
      }
      const row = doc as Record<string, unknown>;
      const nextTitle = hasTitle ? body.title!.trim() : String(row['title'] ?? 'Document');
      const nextText = hasText ? body.text! : (typeof row['text'] === 'string' ? (row['text'] as string) : '');
      const nextActive = body?.active != null ? body.active !== false : row['active'] !== false;
      const setDoc: Record<string, unknown> = {
        title: nextTitle,
        text: nextText,
        active: nextActive,
        status: 'queued',
        error: undefined,
      };
      await this.documentsService.updateFieldsById(botId, id, setDoc);
      await this.documentsService.upsertDocumentKnowledgeItemAfterContentChange(botId, id);
      await this.ingestionService.deleteJobsByDocId(botId, id);
      await this.documentsService.setQueued(botId, id);
      await this.ingestionService.createQueuedJob(botId, id);
      return { ok: true };
    }
    if (body?.active != null) {
      await this.documentsService.setActive(botId, id, body.active !== false);
    }
    return { ok: true };
  }
}
