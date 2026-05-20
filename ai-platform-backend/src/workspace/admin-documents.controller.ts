import { Controller, HttpException, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { DocumentsService } from '../documents/documents.service';
import { BotsService } from '../bots/bots.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { BotKnowledgeTotalLimitService } from '../knowledge/bot-knowledge-total-limit.service';
import { WorkspaceBotDocumentsControllerBase } from './shared/workspace-bot-documents.controller.base';
import { handleWorkspaceBotDocumentUpload } from './shared/workspace-bot-document-upload.handler';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/**
 * Internal operator document list / patch / delete / upload under a bot.
 */
@Controller('api/admin/bots/:botId/documents')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminDocumentsController extends WorkspaceBotDocumentsControllerBase {
  constructor(
    documentsService: DocumentsService,
    botsService: BotsService,
    workspacesService: WorkspacesService,
    ingestionService: IngestionService,
    private readonly botKbTotalLimit: BotKnowledgeTotalLimitService,
  ) {
    super(documentsService, botsService, workspacesService, ingestionService);
  }

  @Post()
  async uploadDocument(@Param('botId') botId: string, @Req() req: RequestWithUser) {
    await this.assertBotAccess(botId, req);
    try {
      return await handleWorkspaceBotDocumentUpload({
        botId,
        req,
        logLabel: AdminDocumentsController.name,
        documentsService: this.documentsService,
        ingestionService: this.ingestionService,
        botKbTotalLimit: this.botKbTotalLimit,
      });
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[admin-documents] upload', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** Operator-only: re-queue document ingestion (chunk/embed pipeline). */
  @Post(':id/embed')
  async requeueIngestion(@Param('botId') botId: string, @Param('id') docId: string, @Req() req: RequestWithUser) {
    await this.assertBotAccess(botId, req);
    if (!Types.ObjectId.isValid(docId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const doc = await this.documentsService.findOneByBotAndDoc(botId, docId);
    if (!doc) {
      throw new HttpException({ error: 'Document not found', errorCode: 'document_not_found' }, HttpStatus.NOT_FOUND);
    }
    await this.ingestionService.deleteJobsByDocId(botId, docId);
    const alignTraining = await this.documentsService.documentKbAlignTrainingQueuedWithIngest(botId, docId);
    await this.documentsService.setQueued(botId, docId, { setTrainingStatusQueued: alignTraining });
    await this.ingestionService.createQueuedJob(botId, docId, { markTrainingQueued: alignTraining });
    return { ok: true };
  }
}
