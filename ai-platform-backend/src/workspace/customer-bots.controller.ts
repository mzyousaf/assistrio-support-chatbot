import { Controller, UseGuards } from '@nestjs/common';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { BotOnboardingService } from './shared/bot-onboarding.service';
import { WorkspaceBotsControllerBase } from './shared/workspace-bots.controller.base';

/** Customer workspace bot APIs (`/api/customer/bots/*`; `ar_customer_session` only). */
@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotsController extends WorkspaceBotsControllerBase {
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
