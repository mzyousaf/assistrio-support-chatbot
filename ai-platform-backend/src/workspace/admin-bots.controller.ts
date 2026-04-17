import { Controller, UseGuards } from '@nestjs/common';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { BotOnboardingService } from './shared/bot-onboarding.service';
import { WorkspaceBotsControllerBase } from './shared/workspace-bots.controller.base';

/**
 * Staff workspace bot APIs (`/api/admin/bots/*`).
 */
@Controller('api/admin/bots')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminBotsController extends WorkspaceBotsControllerBase {
  constructor(
    botsService: BotsService,
    documentsService: DocumentsService,
    botOnboardingService: BotOnboardingService,
    knowledgeBaseItemService: KnowledgeBaseItemService,
    knowledgeBaseChunkService: KnowledgeBaseChunkService,
    workspacesService: WorkspacesService,
  ) {
    super(
      botsService,
      documentsService,
      botOnboardingService,
      knowledgeBaseItemService,
      knowledgeBaseChunkService,
      workspacesService,
    );
  }
}
