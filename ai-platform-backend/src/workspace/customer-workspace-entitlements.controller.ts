import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { WorkspaceAiCreditsUsageService } from '../entitlements/workspace-ai-credits-usage.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Controller('api/customer/workspaces')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerWorkspaceEntitlementsController {
  constructor(
    private readonly entitlementsService: WorkspaceEntitlementsService,
    private readonly aiCreditsUsageService: WorkspaceAiCreditsUsageService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  private async assertWorkspaceMember(req: RequestWithUser, workspaceId: string): Promise<RequestUser> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({ error: 'Customer session required.' });
    }

    const isMember = await this.workspacesService.isUserMemberOfWorkspace(String(user._id), workspaceId);
    if (!isMember) {
      throw new ForbiddenException({ error: 'Workspace access denied.' });
    }

    return user;
  }

  @Get(':workspaceId/entitlements')
  async getEntitlements(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.entitlementsService.resolveForWorkspace(workspaceId);
  }

  @Get(':workspaceId/usage/ai-credits')
  async getAiCreditsUsage(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.aiCreditsUsageService.getWorkspaceAiCreditsUsage(workspaceId);
  }
}
