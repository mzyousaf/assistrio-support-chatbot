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
import {
  KNOWLEDGE_DOCUMENT_MANUAL_BODY_MAX_UTF8_BYTES,
  KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES,
  utf8ByteLength,
} from './bot-field-limits';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/** Shared document list/update/delete for workspace bots. */
export abstract class WorkspaceBotDocumentsControllerBase {
  constructor(
    protected readonly documentsService: DocumentsService,
    protected readonly botsService: BotsService,
    protected readonly workspacesService: WorkspacesService,
    protected readonly ingestionService: IngestionService,
  ) {}

  protected requiresWorkspaceAdminForMutations(): boolean {
    return false;
  }

  protected async assertBotAccess(botId: string, req: RequestWithUser): Promise<void> {
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
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

  protected async assertBotManageAccess(botId: string, req: RequestWithUser): Promise<void> {
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new HttpException({ error: 'Bot not found', errorCode: 'bot_not_found' }, HttpStatus.NOT_FOUND);
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const role = req.user?.role ?? 'customer';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(uid, role, bot as Record<string, unknown>);
    if (!ok) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }
    if (this.requiresWorkspaceAdminForMutations()) {
      await this.workspacesService.assertCanManageWorkspaceBot(uid, role, bot as Record<string, unknown>);
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

  @Post('bulk-delete')
  async bulkDelete(
    @Param('botId') botId: string,
    @Body() body: { docIds?: unknown },
    @Req() req: RequestWithUser,
  ) {
    await this.assertBotManageAccess(botId, req);
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
      throw new HttpException(
        { error: 'Download not available', errorCode: 'document_not_found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return { url };
  }

  /**
   * Document + KB item + chunk counts (debug). Must be declared before `@Get(':id')` so `knowledge-debug` is not captured as `:id`.
   */
  @Get(':id/knowledge-debug')
  async documentKnowledgeDebug(@Param('botId') botId: string, @Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertBotAccess(botId, req);
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const dbg = await this.documentsService.getDocumentKnowledgeDebug(botId, id);
    if (!dbg) {
      throw new HttpException({ error: 'Not found', errorCode: 'document_not_found' }, HttpStatus.NOT_FOUND);
    }
    return dbg;
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
      throw new HttpException({ error: 'Not found', errorCode: 'document_not_found' }, HttpStatus.NOT_FOUND);
    }
    return { document: doc as Record<string, unknown> };
  }

  @Delete(':id')
  async remove(@Param('botId') botId: string, @Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertBotManageAccess(botId, req);
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
    await this.assertBotManageAccess(botId, req);
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
      if (hasTitle) {
        const tt = body.title!.trim();
        const titleBytes = utf8ByteLength(tt);
        const MIN_TITLE_CHARS = 1;
        if (tt.length < MIN_TITLE_CHARS || titleBytes > KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES) {
          throw new HttpException(
            {
              error: `Title must be at least ${MIN_TITLE_CHARS} character${MIN_TITLE_CHARS > 1 ? 's' : ''} (after trimming) and at most ${KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES} bytes (UTF-8).`,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }
      if (hasText) {
        const bodyBytes = utf8ByteLength(body.text!);
        if (bodyBytes > KNOWLEDGE_DOCUMENT_MANUAL_BODY_MAX_UTF8_BYTES) {
          throw new HttpException(
            { error: `Text must be at most ${KNOWLEDGE_DOCUMENT_MANUAL_BODY_MAX_UTF8_BYTES} bytes (UTF-8).` },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (!body.text!.trim()) {
          throw new HttpException({ error: 'Text cannot be empty.' }, HttpStatus.BAD_REQUEST);
        }
      }
      const doc = await this.documentsService.findOneByBotAndDoc(botId, id);
      if (!doc) {
        throw new HttpException({ error: 'Not found', errorCode: 'document_not_found' }, HttpStatus.NOT_FOUND);
      }
      this.documentsService.assertDocumentPresentationEligibleForKbManualPatch(doc as Record<string, unknown>);
      await this.documentsService.assertKbDocumentContentPatchTrainingGate(botId, id);
      const row = doc as Record<string, unknown>;
      const nextTitle = hasTitle ? body.title!.trim() : String(row['title'] ?? 'Document');
      const nextText = hasText ? body.text! : (typeof row['text'] === 'string' ? (row['text'] as string) : '');
      const nextActive = body?.active != null ? body.active !== false : row['active'] !== false;
      const setDoc: Record<string, unknown> = {
        title: nextTitle,
        text: nextText,
        active: nextActive,
        error: undefined,
      };
      const trainingSettings = await this.documentsService.getKnowledgeTrainingSettingsForBot(botId);
      const patchNoop = await this.documentsService.documentKbManualPatchIsNoop(
        botId,
        id,
        nextTitle,
        nextText,
        nextActive,
      );
      if (patchNoop) {
        return { ok: true };
      }
      await this.documentsService.updateFieldsById(botId, id, setDoc);
      await this.documentsService.upsertDocumentKnowledgeItemAfterContentChange(botId, id, trainingSettings);
      await this.ingestionService.deleteJobsByDocId(botId, id);
      const alignTraining = await this.documentsService.documentKbAlignTrainingQueuedWithIngest(botId, id);
      const markTrainAligned = trainingSettings.autoTrainEnabled === true && alignTraining;
      const skipExtract = await this.documentsService.documentManualPatchShouldSkipExtractJob(botId, id);
      if (skipExtract) {
        await this.ingestionService.finalizeDocumentManualPatchWithoutExtractJob(botId, id, markTrainAligned);
      } else {
        await this.documentsService.setQueued(botId, id, { setTrainingStatusQueued: markTrainAligned });
        await this.ingestionService.createQueuedJob(botId, id, { markTrainingQueued: markTrainAligned });
      }
      return { ok: true };
    }
    if (body?.active != null) {
      await this.documentsService.setActive(botId, id, body.active !== false);
    }
    return { ok: true };
  }
}
