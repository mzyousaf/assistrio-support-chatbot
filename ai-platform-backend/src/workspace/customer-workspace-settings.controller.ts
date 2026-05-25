import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { parseWorkspaceDefaultBotAccessPolicyPatch } from '../workspaces/workspace-default-bot-access-policy.util';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Controller('api/customer/workspaces')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerWorkspaceSettingsController {
  constructor(private readonly workspacesService: WorkspacesService) {}

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

  @Get(':workspaceId/settings')
  async getSettings(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    const user = this.assertCustomer(req.user);
    await this.workspacesService.assertWorkspaceAdmin(String(user._id), workspaceId);
    return this.workspacesService.getWorkspaceSettings(workspaceId);
  }

  @Patch(':workspaceId/settings')
  async patchSettings(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    const user = this.assertCustomer(req.user);
    const policy = parseWorkspaceDefaultBotAccessPolicyPatch(body);
    if (!policy) {
      throw new BadRequestException({ message: 'defaultBotAccessPolicy is required.' });
    }
    return this.workspacesService.updateWorkspaceDefaultBotAccessPolicy(
      workspaceId,
      String(user._id),
      policy,
    );
  }
}
