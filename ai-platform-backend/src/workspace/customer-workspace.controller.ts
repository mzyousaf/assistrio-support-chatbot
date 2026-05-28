import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Param,
  Patch,
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

type PatchWorkspaceBody = {
  name?: string;
};

@Controller('api/customer/workspaces')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerWorkspaceController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly entitlementsService: WorkspaceEntitlementsService,
  ) {}

  private assertCustomer(user: RequestUser | undefined): RequestUser {
    if (!user) {
      throw new ForbiddenException({ error: 'Customer session required.' });
    }
    if (user.role !== 'customer') {
      throw new ForbiddenException({
        error: 'Customer session required.',
        errorCode: 'CUSTOMER_SESSION_REQUIRED',
      });
    }
    return user;
  }

  @Patch(':workspaceId')
  async patchWorkspace(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: PatchWorkspaceBody,
  ) {
    const user = this.assertCustomer(req.user);
    if (body?.name === undefined) {
      throw new BadRequestException({ message: 'name is required.' });
    }
    const updated = await this.workspacesService.updateWorkspaceName(
      workspaceId,
      String(user._id),
      String(body.name),
    );
    const session = await buildCustomerSessionPayload(user, this.workspacesService, this.entitlementsService);
    return { workspace: updated, session };
  }

  @Delete(':workspaceId')
  async deleteWorkspace(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    const user = this.assertCustomer(req.user);
    await this.workspacesService.deleteWorkspaceForOwner(workspaceId, String(user._id));
    const session = await buildCustomerSessionPayload(user, this.workspacesService, this.entitlementsService);
    return { success: true, session };
  }
}
