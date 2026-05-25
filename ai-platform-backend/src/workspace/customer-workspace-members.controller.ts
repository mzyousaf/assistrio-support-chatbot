import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { WORKSPACE_INVITE_ROLES, type WorkspaceInviteRole } from '../models/workspace-invite.constants';
import { WORKSPACE_OWNER_ROLE } from '../models/workspace-membership.schema';
import { WorkspaceInviteService } from '../workspaces/workspace-invite.service';
import { WorkspaceInviteEmailService } from '../workspaces/workspace-invite-email.service';
import { WorkspaceInviteDeliveryService } from '../workspaces/workspace-invite-delivery.service';
import { buildWorkspaceInviteUrl } from '../workspaces/workspace-invite-url.util';
import {
  serializeWorkspaceInvite,
  type CreateWorkspaceInviteResponse,
} from '../workspaces/workspace-invite.types';
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

type CreateInviteBody = {
  email?: string;
  role?: WorkspaceInviteRole | typeof WORKSPACE_OWNER_ROLE;
  botGrants?: Array<{ botId?: string; canView?: boolean; canPreview?: boolean }>;
};

type RolePatchBody = {
  role?: WorkspaceInviteRole | typeof WORKSPACE_OWNER_ROLE;
};

@Controller('api/customer/workspaces')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerWorkspaceMembersController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly inviteService: WorkspaceInviteService,
    private readonly inviteEmailService: WorkspaceInviteEmailService,
    private readonly inviteDeliveryService: WorkspaceInviteDeliveryService,
    private readonly configService: ConfigService,
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

  private async assertWorkspaceAdmin(req: RequestWithUser, workspaceId: string): Promise<RequestUser> {
    const user = this.assertCustomer(req.user);
    await this.workspacesService.assertWorkspaceAdmin(String(user._id), workspaceId);
    return user;
  }

  private maybeAttachInviteUrl(
    invite: ReturnType<typeof serializeWorkspaceInvite>,
    plainToken?: string,
  ): CreateWorkspaceInviteResponse {
    const serialized = { ...invite };
    if (plainToken && this.inviteDeliveryService.shouldExposeInviteUrl()) {
      const inviteUrl = buildWorkspaceInviteUrl(
        this.configService.get<string>('customerAppBaseUrl') ?? '',
        plainToken,
      );
      if (inviteUrl) {
        return { ...serialized, inviteUrl };
      }
    }
    return serialized;
  }

  private async deliverInviteEmail(params: {
    workspaceId: string;
    invitedByUserId: string;
    recipientEmail: string;
    role: WorkspaceInviteRole;
    expiresAt: Date;
    plainToken: string;
    context: 'create' | 'resend';
  }): Promise<void> {
    const inviteUrl = buildWorkspaceInviteUrl(
      this.configService.get<string>('customerAppBaseUrl') ?? '',
      params.plainToken,
    );
    if (!inviteUrl) {
      this.inviteDeliveryService.assertInviteEmailDeliveryResult(
        {
          ok: false,
          reason: 'not_configured',
          message: 'CUSTOMER_APP_BASE_URL is not configured.',
        },
        params.context,
      );
      return;
    }

    const result = await this.inviteEmailService.sendWorkspaceInviteEmail({
      workspaceId: params.workspaceId,
      invitedByUserId: params.invitedByUserId,
      recipientEmail: params.recipientEmail,
      role: params.role,
      expiresAt: params.expiresAt,
      inviteUrl,
    });
    this.inviteDeliveryService.assertInviteEmailDeliveryResult(result, params.context);
  }

  @Get(':workspaceId/members')
  async listMembers(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceAdmin(req, workspaceId);
    const members = await this.workspacesService.listWorkspaceMembers(workspaceId);
    const enriched = await Promise.all(
      members.map(async (member) => ({
        ...member,
        botAccessSummary: await this.workspacesService.summarizeMemberBotAccess(workspaceId, member.userId),
      })),
    );
    return enriched;
  }

  @Get(':workspaceId/invites')
  async listInvites(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceAdmin(req, workspaceId);
    const invites = await this.inviteService.listInvitesForWorkspace(workspaceId);
    const enriched = await Promise.all(
      invites.map(async (invite) => ({
        ...invite,
        botAccessSummary: await this.workspacesService.summarizeInviteBotAccess(workspaceId, invite.id),
      })),
    );
    return enriched;
  }

  @Post(':workspaceId/invites')
  async createInvite(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateInviteBody,
  ) {
    const user = await this.assertWorkspaceAdmin(req, workspaceId);
    const email = String(body?.email ?? '').trim();
    const roleRaw = String(body?.role ?? 'member').trim();
    if (roleRaw === WORKSPACE_OWNER_ROLE) {
      throw new BadRequestException({ message: 'Owner role cannot be assigned via invite.' });
    }
    const role = (WORKSPACE_INVITE_ROLES as readonly string[]).includes(roleRaw)
      ? (roleRaw as WorkspaceInviteRole)
      : 'member';

    const { invite, plainToken } = await this.inviteService.createPendingInvite({
      workspaceId,
      email,
      role,
      invitedByUserId: String(user._id),
    });

    const inviteId = String((invite as { _id?: { toString(): string } })._id);
    const botGrants = Array.isArray(body?.botGrants) ? body.botGrants : [];
    if (botGrants.length > 0) {
      await this.workspacesService.assertWorkspaceOwner(String(user._id), workspaceId);
      for (const g of botGrants) {
        const botId = String(g?.botId ?? '').trim();
        if (!botId) continue;
        await this.workspacesService.upsertBotAccessGrants({
          workspaceId,
          botId,
          createdByUserId: String(user._id),
          grants: [
            {
              subjectType: 'invite',
              inviteId,
              canView: g.canView === true,
              canPreview: g.canPreview === true,
            },
          ],
        });
      }
    }

    const serializedInvite = serializeWorkspaceInvite(invite as never);
    await this.deliverInviteEmail({
      workspaceId,
      invitedByUserId: serializedInvite.invitedByUserId,
      recipientEmail: serializedInvite.email,
      role: serializedInvite.role,
      expiresAt: serializedInvite.expiresAt,
      plainToken,
      context: 'create',
    });

    return this.maybeAttachInviteUrl(serializedInvite, plainToken);
  }

  @Patch(':workspaceId/members/:userId/role')
  async patchMemberRole(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() body: RolePatchBody,
  ) {
    const user = this.assertCustomer(req.user);
    const roleRaw = String(body?.role ?? '').trim();
    if (roleRaw === WORKSPACE_OWNER_ROLE) {
      throw new BadRequestException({ message: 'Owner role cannot be assigned here.' });
    }
    if (!(WORKSPACE_INVITE_ROLES as readonly string[]).includes(roleRaw)) {
      throw new BadRequestException({ message: 'role must be admin or member.' });
    }
    await this.workspacesService.updateWorkspaceMemberRole(
      workspaceId,
      userId,
      roleRaw as WorkspaceInviteRole,
      String(user._id),
    );
    return { success: true };
  }

  @Patch(':workspaceId/invites/:inviteId/role')
  async patchInviteRole(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('inviteId') inviteId: string,
    @Body() body: RolePatchBody,
  ) {
    const user = this.assertCustomer(req.user);
    await this.workspacesService.assertWorkspaceOwner(String(user._id), workspaceId);
    const roleRaw = String(body?.role ?? '').trim();
    if (roleRaw === WORKSPACE_OWNER_ROLE) {
      throw new BadRequestException({ message: 'Owner role cannot be assigned via invite.' });
    }
    if (!(WORKSPACE_INVITE_ROLES as readonly string[]).includes(roleRaw)) {
      throw new BadRequestException({ message: 'role must be admin or member.' });
    }
    await this.inviteService.updateInviteRole(workspaceId, inviteId, roleRaw as WorkspaceInviteRole);
    return { success: true };
  }

  @Post(':workspaceId/invites/:inviteId/cancel')
  async cancelInvite(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('inviteId') inviteId: string,
  ) {
    await this.assertWorkspaceAdmin(req, workspaceId);
    await this.inviteService.cancelInvite(workspaceId, inviteId);
    return { success: true };
  }

  @Post(':workspaceId/invites/:inviteId/resend')
  async resendInvite(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('inviteId') inviteId: string,
  ) {
    await this.assertWorkspaceAdmin(req, workspaceId);
    const { invite, plainToken } = await this.inviteService.resendInvite(workspaceId, inviteId);
    const serializedInvite = serializeWorkspaceInvite(invite as never);

    await this.deliverInviteEmail({
      workspaceId,
      invitedByUserId: serializedInvite.invitedByUserId,
      recipientEmail: serializedInvite.email,
      role: serializedInvite.role,
      expiresAt: serializedInvite.expiresAt,
      plainToken,
      context: 'resend',
    });

    return this.maybeAttachInviteUrl(serializedInvite, plainToken);
  }

  @Delete(':workspaceId/members/:userId')
  async removeMember(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    const user = await this.assertWorkspaceAdmin(req, workspaceId);
    await this.workspacesService.removeWorkspaceMember(workspaceId, userId, String(user._id));
    return { success: true };
  }
}
