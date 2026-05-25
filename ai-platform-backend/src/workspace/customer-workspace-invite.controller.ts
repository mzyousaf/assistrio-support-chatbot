import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import { buildCustomerSessionPayload } from '../auth/customer/customer-session.payload';
import type { RequestUser } from '../auth/shared/request-user.types';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { WorkspaceInviteService } from '../workspaces/workspace-invite.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Controller('api/customer/invites')
export class CustomerWorkspaceInviteController {
  constructor(
    private readonly inviteService: WorkspaceInviteService,
    private readonly workspacesService: WorkspacesService,
    private readonly entitlementsService: WorkspaceEntitlementsService,
  ) {}

  @Get(':token/preview')
  preview(@Param('token') token: string) {
    return this.inviteService.previewInviteByToken(token);
  }

  @Post(':token/accept')
  @UseGuards(CustomerSessionAuthGuard)
  async accept(@Req() req: RequestWithUser, @Param('token') token: string) {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({ error: 'Customer session required.' });
    }
    if (user.role !== 'customer') {
      throw new ForbiddenException({
        error: 'Customer session required.',
        errorCode: 'CUSTOMER_SESSION_REQUIRED',
      });
    }

    await this.inviteService.acceptInviteForUser(token, String(user._id), user.email);
    return buildCustomerSessionPayload(user, this.workspacesService, this.entitlementsService);
  }
}
