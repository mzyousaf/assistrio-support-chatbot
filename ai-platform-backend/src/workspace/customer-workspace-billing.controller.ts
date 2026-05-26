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
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceBillingSummaryService } from './workspace-billing-summary.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Controller('api/customer/workspaces')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerWorkspaceBillingController {
  constructor(
    private readonly billingSummaryService: WorkspaceBillingSummaryService,
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

  @Get(':workspaceId/billing/summary')
  async getBillingSummary(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.billingSummaryService.getSummary(workspaceId);
  }
}
