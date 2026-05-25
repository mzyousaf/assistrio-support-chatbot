import { BadGatewayException, BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CustomerWorkspaceMembersController } from './customer-workspace-members.controller';
import {
  EMAIL_DELIVERY_FAILED_CODE,
  EMAIL_DELIVERY_NOT_CONFIGURED_CODE,
} from '../email/email.constants';
import { WORKSPACE_LAST_MANAGER_REQUIRED_CODE } from '../models/workspace-invite.constants';

describe('CustomerWorkspaceMembersController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const adminUserId = '507f1f77bcf86cd799439012';
  const memberUserId = '507f1f77bcf86cd799439013';

  function buildController(options?: {
    isAdmin?: boolean;
    removeError?: Error;
    nodeEnv?: string;
    emailSendResult?: { ok: true; id: string } | { ok: false; reason: 'not_configured' | 'send_failed'; message: string };
  }) {
    const workspacesService = {
      assertWorkspaceAdmin: options?.isAdmin === false
        ? jest.fn().mockRejectedValue(new ForbiddenException({ errorCode: 'workspace_access_denied' }))
        : jest.fn().mockResolvedValue(undefined),
      listWorkspaceMembers: jest.fn().mockResolvedValue([
        { userId: adminUserId, email: 'admin@example.com', role: 'admin', joinedAt: null },
      ]),
      removeWorkspaceMember: options?.removeError
        ? jest.fn().mockRejectedValue(options.removeError)
        : jest.fn().mockResolvedValue(undefined),
    };

    const inviteDoc = {
      _id: new Types.ObjectId(),
      email: 'guest@example.com',
      role: 'member',
      status: 'pending',
      expiresAt: new Date('2026-06-15T12:00:00.000Z'),
      invitedByUserId: new Types.ObjectId(adminUserId),
    };

    const inviteService = {
      listInvitesForWorkspace: jest.fn().mockResolvedValue([
        {
          id: 'invite1',
          email: 'guest@example.com',
          role: 'member',
          status: 'pending',
          expiresAt: new Date(),
          invitedByUserId: adminUserId,
          acceptedByUserId: null,
          acceptedAt: null,
          cancelledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      createPendingInvite: jest.fn().mockResolvedValue({
        invite: inviteDoc,
        plainToken: 'plain-token',
      }),
      cancelInvite: jest.fn().mockResolvedValue(undefined),
      resendInvite: jest.fn().mockResolvedValue({
        invite: inviteDoc,
        plainToken: 'plain-token',
      }),
    };

    const inviteEmailService = {
      sendWorkspaceInviteEmail: jest.fn().mockResolvedValue(
        options?.emailSendResult ?? { ok: true, id: 'email_123' },
      ),
    };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'nodeEnv') return options?.nodeEnv ?? 'development';
        if (key === 'customerAppBaseUrl') return 'http://localhost:3002';
        return '';
      }),
    };

    const inviteDeliveryService = {
      shouldExposeInviteUrl: jest.fn().mockReturnValue((options?.nodeEnv ?? 'development') !== 'production'),
      assertInviteEmailDeliveryResult: jest.fn((result, _context) => {
        const nodeEnv = options?.nodeEnv ?? 'development';
        if (result.ok) return;
        if (nodeEnv === 'production') {
          if (result.reason === 'not_configured') {
            throw new ServiceUnavailableException({
              errorCode: EMAIL_DELIVERY_NOT_CONFIGURED_CODE,
            });
          }
          if (result.reason === 'send_failed') {
            throw new BadGatewayException({
              errorCode: EMAIL_DELIVERY_FAILED_CODE,
            });
          }
        }
      }),
    };

    const controller = new CustomerWorkspaceMembersController(
      workspacesService as never,
      inviteService as never,
      inviteEmailService as never,
      inviteDeliveryService as never,
      configService as never,
    );

    return { controller, workspacesService, inviteService, inviteEmailService, inviteDeliveryService, configService };
  }

  const adminReq = {
    user: { _id: adminUserId, email: 'admin@example.com', role: 'customer' },
  } as never;

  it('admin can list members', async () => {
    const { controller, workspacesService } = buildController();
    const result = await controller.listMembers(adminReq, workspaceId);
    expect(workspacesService.assertWorkspaceAdmin).toHaveBeenCalledWith(adminUserId, workspaceId);
    expect(result).toHaveLength(1);
  });

  it('non-admin cannot create invite', async () => {
    const { controller } = buildController({ isAdmin: false });
    await expect(
      controller.createInvite(adminReq, workspaceId, { email: 'guest@example.com', role: 'member' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects owner role on invite create', async () => {
    const { controller, inviteService } = buildController();
    await expect(
      controller.createInvite(adminReq, workspaceId, { email: 'guest@example.com', role: 'owner' as never }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(inviteService.createPendingInvite).not.toHaveBeenCalled();
  });

  it('create invite sends email and returns inviteUrl in non-production', async () => {
    const { controller, inviteEmailService } = buildController();
    const result = await controller.createInvite(adminReq, workspaceId, {
      email: 'guest@example.com',
      role: 'member',
    });
    expect(inviteEmailService.sendWorkspaceInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'guest@example.com',
        inviteUrl: 'http://localhost:3002/invite/plain-token',
      }),
    );
    expect(result.inviteUrl).toContain('/invite/plain-token');
    expect(result).not.toHaveProperty('tokenHash');
  });

  it('resend invite sends email again', async () => {
    const { controller, inviteEmailService } = buildController();
    await controller.resendInvite(adminReq, workspaceId, 'invite1');
    expect(inviteEmailService.sendWorkspaceInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'guest@example.com',
        inviteUrl: 'http://localhost:3002/invite/plain-token',
      }),
    );
  });

  it('create invite throws email_delivery_not_configured in production when email is not configured', async () => {
    const { controller } = buildController({
      nodeEnv: 'production',
      emailSendResult: { ok: false, reason: 'not_configured', message: 'missing' },
    });
    await expect(
      controller.createInvite(adminReq, workspaceId, { email: 'guest@example.com', role: 'member' }),
    ).rejects.toMatchObject({
      response: { errorCode: EMAIL_DELIVERY_NOT_CONFIGURED_CODE },
    });
  });

  it('create invite throws email_delivery_failed in production when send fails', async () => {
    const { controller, inviteService } = buildController({
      nodeEnv: 'production',
      emailSendResult: { ok: false, reason: 'send_failed', message: 'Resend down' },
    });
    await expect(
      controller.createInvite(adminReq, workspaceId, { email: 'guest@example.com', role: 'member' }),
    ).rejects.toMatchObject({
      response: { errorCode: EMAIL_DELIVERY_FAILED_CODE },
    });
    expect(inviteService.createPendingInvite).toHaveBeenCalled();
  });

  it('create invite still returns inviteUrl in development when email is not configured', async () => {
    const { controller } = buildController({
      nodeEnv: 'development',
      emailSendResult: { ok: false, reason: 'not_configured', message: 'missing' },
    });
    const result = await controller.createInvite(adminReq, workspaceId, {
      email: 'guest@example.com',
      role: 'member',
    });
    expect(result.inviteUrl).toContain('/invite/plain-token');
  });

  it('list invites does not expose tokenHash', async () => {
    const { controller } = buildController();
    const result = await controller.listInvites(adminReq, workspaceId);
    expect(result[0]).not.toHaveProperty('tokenHash');
  });

  it('cancel invite succeeds for admin', async () => {
    const { controller, inviteService } = buildController();
    const result = await controller.cancelInvite(adminReq, workspaceId, 'invite1');
    expect(inviteService.cancelInvite).toHaveBeenCalledWith(workspaceId, 'invite1');
    expect(result).toEqual({ success: true });
  });

  it('remove member blocks non-admin', async () => {
    const { controller } = buildController({ isAdmin: false });
    await expect(controller.removeMember(adminReq, workspaceId, memberUserId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('remove member propagates last manager protection', async () => {
    const { controller } = buildController({
      removeError: new ForbiddenException({
        errorCode: WORKSPACE_LAST_MANAGER_REQUIRED_CODE,
      }),
    });
    await expect(controller.removeMember(adminReq, workspaceId, adminUserId)).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_LAST_MANAGER_REQUIRED_CODE },
    });
  });
});

