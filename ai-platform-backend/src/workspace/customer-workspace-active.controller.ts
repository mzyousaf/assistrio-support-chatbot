import {
  Controller,
  ForbiddenException,
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
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Controller('api/customer/workspaces')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerWorkspaceActiveController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly entitlementsService: WorkspaceEntitlementsService,
  ) {}

  @Post(':workspaceId/activate')
  async activate(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
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

    await this.workspacesService.activateWorkspaceForUser(String(user._id), workspaceId);
    return buildCustomerSessionPayload(user, this.workspacesService, this.entitlementsService);
  }
}
