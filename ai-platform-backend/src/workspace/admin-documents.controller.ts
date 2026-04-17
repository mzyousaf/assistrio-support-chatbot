import { Controller, UseGuards } from '@nestjs/common';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { DocumentsService } from '../documents/documents.service';
import { BotsService } from '../bots/bots.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { WorkspaceBotDocumentsControllerBase } from './shared/workspace-bot-documents.controller.base';

/**
 * Internal operator document list / patch / delete under a bot.
 */
@Controller('api/admin/bots/:botId/documents')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminDocumentsController extends WorkspaceBotDocumentsControllerBase {
  constructor(
    documentsService: DocumentsService,
    botsService: BotsService,
    workspacesService: WorkspacesService,
    ingestionService: IngestionService,
  ) {
    super(documentsService, botsService, workspacesService, ingestionService);
  }
}
