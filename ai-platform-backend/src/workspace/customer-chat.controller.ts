import { Controller, UseGuards } from '@nestjs/common';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import { BotsService } from '../bots/bots.service';
import { ChatEngineService } from '../chat/chat-engine.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceUserChatControllerBase } from './shared/workspace-user-chat.controller.base';

@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerChatController extends WorkspaceUserChatControllerBase {
  constructor(botsService: BotsService, chatEngineService: ChatEngineService, workspacesService: WorkspacesService) {
    super(botsService, chatEngineService, workspacesService);
  }
}
