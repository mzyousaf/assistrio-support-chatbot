import { Controller, HttpException, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
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
 * Customer workspace documents — list, upload, patch, delete, bulk-delete, and
 * {@link WorkspaceBotDocumentsControllerBase.downloadUrl GET :id/download-url} (signed S3 / URL for ready, active uploads).
 */
@Controller('api/customer/bots/:botId/documents')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerDocumentsController extends WorkspaceBotDocumentsControllerBase {
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
        logLabel: CustomerDocumentsController.name,
        documentsService: this.documentsService,
        ingestionService: this.ingestionService,
        botKbTotalLimit: this.botKbTotalLimit,
      });
    } catch (e) {
      if (e instanceof HttpException) throw e;
      console.error('[customer-documents] upload', e);
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
