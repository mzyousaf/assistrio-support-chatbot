import { ConflictException, GoneException, HttpException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  WORKSPACE_INVITE_ALREADY_PENDING_CODE,
  WORKSPACE_INVITE_ALREADY_ACCEPTED_CODE,
  WORKSPACE_INVITE_CANCELLED_CODE,
  WORKSPACE_INVITE_DEFAULT_TTL_MS,
  WORKSPACE_INVITE_EMAIL_MISMATCH_CODE,
  WORKSPACE_INVITE_EXPIRED_CODE,
  WORKSPACE_INVITE_MEMBER_EXISTS_CODE,
  WORKSPACE_INVITE_NOT_FOUND_CODE,
} from '../models/workspace-invite.constants';
import type { WorkspaceMemberLimitService } from '../entitlements/workspace-member-limit.service';
import type { WorkspacesService } from './workspaces.service';
import {
  WorkspaceInviteService,
  normalizeInviteEmail,
} from './workspace-invite.service';
import {
  createWorkspaceInviteToken,
  hashWorkspaceInviteToken,
  verifyWorkspaceInviteToken,
} from './workspace-invite-token.util';

describe('WorkspaceInviteService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const invitedByUserId = '507f1f77bcf86cd799439012';
  const acceptUserId = '507f1f77bcf86cd799439014';
  const now = new Date('2026-05-24T12:00:00.000Z');
  const wsOid = new Types.ObjectId(workspaceId);

  type InviteRow = {
    _id: Types.ObjectId;
    workspaceId: Types.ObjectId;
    email: string;
    role: string;
    tokenHash: string;
    status: string;
    invitedByUserId: Types.ObjectId;
    expiresAt: Date;
    acceptedByUserId?: Types.ObjectId;
    acceptedAt?: Date;
    cancelledAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
  };

  type MembershipRow = {
    workspaceId: Types.ObjectId;
    userId: Types.ObjectId;
    role: string;
  };

  function makeService(options?: {
    initialInvites?: InviteRow[];
    initialMemberships?: MembershipRow[];
    users?: Array<{ _id: Types.ObjectId; email: string; firstName?: string; lastName?: string }>;
    workspaces?: Array<{ _id: Types.ObjectId; name: string }>;
    isMember?: boolean;
  }) {
    const invites = [...(options?.initialInvites ?? [])];
    const memberships = [...(options?.initialMemberships ?? [])];
    const users = [...(options?.users ?? [])];
    const workspaces = [...(options?.workspaces ?? [{ _id: wsOid, name: 'Team Workspace' }])];

    const inviteModel = {
      findOne: jest.fn((filter: Record<string, unknown>) => ({
        exec: jest.fn(async () => {
          if (filter.tokenHash) {
            return invites.find((row) => row.tokenHash === filter.tokenHash) ?? null;
          }
          const ws = String((filter as { workspaceId?: Types.ObjectId }).workspaceId ?? '');
          const email = (filter as { email?: string }).email;
          const status = (filter as { status?: string }).status;
          const id = (filter as { _id?: Types.ObjectId })._id;
          return (
            invites.find((row) => {
              if (id && String(row._id) !== String(id)) return false;
              if (ws && String(row.workspaceId) !== ws) return false;
              if (email && row.email !== email) return false;
              if (status && row.status !== status) return false;
              return true;
            }) ?? null
          );
        }),
      })),
      find: jest.fn((filter: { workspaceId?: Types.ObjectId }) => ({
        sort: jest.fn(() => ({
          exec: jest.fn(async () =>
            invites.filter((row) => String(row.workspaceId) === String(filter.workspaceId)),
          ),
        })),
      })),
      findById: jest.fn((id: Types.ObjectId) => ({
        exec: jest.fn(async () => invites.find((row) => String(row._id) === String(id)) ?? null),
      })),
      updateOne: jest.fn(
        async (
          filter: { _id: Types.ObjectId },
          update: { $set?: Record<string, unknown>; $unset?: Record<string, unknown> },
        ) => {
          const idx = invites.findIndex((row) => String(row._id) === String(filter._id));
          if (idx < 0) return { modifiedCount: 0 };
          invites[idx] = { ...invites[idx]!, ...(update.$set ?? {}) } as InviteRow;
          return { modifiedCount: 1 };
        },
      ),
      create: jest.fn(async (doc: Omit<InviteRow, '_id'>) => {
        const row: InviteRow = {
          _id: new Types.ObjectId(),
          createdAt: now,
          updatedAt: now,
          ...doc,
        };
        invites.push(row);
        return row;
      }),
    };

    const membershipModel = {
      findOne: jest.fn((filter: { workspaceId?: Types.ObjectId; userId?: Types.ObjectId }) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () =>
            memberships.find(
              (row) =>
                String(row.workspaceId) === String(filter.workspaceId) &&
                String(row.userId) === String(filter.userId),
            ) ?? null,
          ),
        })),
      })),
      create: jest.fn(async (doc: MembershipRow) => {
        memberships.push(doc);
        return doc;
      }),
    };

    const userModel = {
      findOne: jest.fn((filter: { email?: string }) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => users.find((user) => user.email === filter.email) ?? null),
        })),
      })),
      findById: jest.fn((id: Types.ObjectId) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => users.find((user) => String(user._id) === String(id)) ?? null),
        })),
      })),
    };

    const workspaceModel = {
      findById: jest.fn((id: Types.ObjectId) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => workspaces.find((ws) => String(ws._id) === String(id)) ?? null),
        })),
      })),
    };

    const memberLimitService = {
      assertCanInviteMember: jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceMemberLimitService;

    const workspacesService = {
      isUserMemberOfWorkspace: jest
        .fn()
        .mockImplementation(async (_userId: string, wsId: string) => {
          if (options?.isMember != null) return options.isMember;
          return memberships.some((row) => String(row.workspaceId) === wsId);
        }),
      activateWorkspaceForUser: jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspacesService;

    const grantService = {
      migrateInviteGrantsToUser: jest.fn().mockResolvedValue(undefined),
      deleteInviteGrants: jest.fn().mockResolvedValue(undefined),
    };

    const service = new WorkspaceInviteService(
      inviteModel as never,
      membershipModel as never,
      userModel as never,
      workspaceModel as never,
      memberLimitService,
      workspacesService,
      grantService as never,
    );

    return {
      service,
      inviteModel,
      membershipModel,
      memberLimitService,
      workspacesService,
      invites,
      memberships,
    };
  }

  it('creates pending invite with hashed token and returns plain token once', async () => {
    const { service, inviteModel, invites } = makeService();

    const result = await service.createPendingInvite({
      workspaceId,
      email: 'Teammate@Example.com',
      invitedByUserId,
      now,
    });

    expect(normalizeInviteEmail('Teammate@Example.com')).toBe('teammate@example.com');
    expect(result.plainToken).toBeTruthy();
    expect(verifyWorkspaceInviteToken(result.invite.tokenHash, result.plainToken)).toBe(true);
    expect(inviteModel.create).toHaveBeenCalled();
    expect(invites[0]?.tokenHash).not.toBe(result.plainToken);
  });

  it('throws workspace_invite_member_exists when email is already a member', async () => {
    const memberUserId = new Types.ObjectId();
    const { service } = makeService({
      users: [{ _id: memberUserId, email: 'member@example.com' }],
      initialMemberships: [{ workspaceId: wsOid, userId: memberUserId, role: 'member' }],
    });

    await expect(
      service.createPendingInvite({
        workspaceId,
        email: 'member@example.com',
        invitedByUserId,
        now,
      }),
    ).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_INVITE_MEMBER_EXISTS_CODE },
    });
  });

  it('throws 409 when non-expired pending invite exists', async () => {
    const { service } = makeService({
      initialInvites: [
        {
          _id: new Types.ObjectId(),
          workspaceId: wsOid,
          email: 'dup@example.com',
          role: 'member',
          tokenHash: 'abc',
          status: 'pending',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
    });

    await expect(
      service.createPendingInvite({ workspaceId, email: 'dup@example.com', invitedByUserId, now }),
    ).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_INVITE_ALREADY_PENDING_CODE },
    });
  });

  it('preview returns safe invite preview for valid pending invite', async () => {
    const token = createWorkspaceInviteToken();
    const { service } = makeService({
      initialInvites: [
        {
          _id: new Types.ObjectId(),
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: hashWorkspaceInviteToken(token),
          status: 'pending',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
      users: [
        {
          _id: new Types.ObjectId(invitedByUserId),
          email: 'owner@example.com',
          firstName: 'Owner',
          lastName: 'User',
        },
      ],
    });

    const preview = await service.previewInviteByToken(token, now);
    expect(preview).toMatchObject({
      workspaceName: 'Team Workspace',
      invitedEmail: 'guest@example.com',
      role: 'member',
      inviterEmail: 'owner@example.com',
      inviterName: 'Owner User',
    });
  });

  it('preview returns workspace_invite_not_found for invalid token', async () => {
    const { service } = makeService();
    await expect(service.previewInviteByToken('bad-token', now)).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_INVITE_NOT_FOUND_CODE },
    });
  });

  it('preview returns workspace_invite_expired for expired invite', async () => {
    const token = createWorkspaceInviteToken();
    const { service } = makeService({
      initialInvites: [
        {
          _id: new Types.ObjectId(),
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: hashWorkspaceInviteToken(token),
          status: 'pending',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() - 1_000),
        },
      ],
    });

    await expect(service.previewInviteByToken(token, now)).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_INVITE_EXPIRED_CODE },
    });
  });

  it('preview returns workspace_invite_cancelled', async () => {
    const token = createWorkspaceInviteToken();
    const { service } = makeService({
      initialInvites: [
        {
          _id: new Types.ObjectId(),
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: hashWorkspaceInviteToken(token),
          status: 'cancelled',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
    });

    await expect(service.previewInviteByToken(token, now)).rejects.toBeInstanceOf(GoneException);
  });

  it('accept creates membership, marks invite accepted, and activates workspace', async () => {
    const token = createWorkspaceInviteToken();
    const inviteId = new Types.ObjectId();
    const { service, memberships, workspacesService, invites } = makeService({
      initialInvites: [
        {
          _id: inviteId,
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: hashWorkspaceInviteToken(token),
          status: 'pending',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
      isMember: false,
    });

    const result = await service.acceptInviteForUser(
      token,
      acceptUserId,
      'guest@example.com',
      now,
    );

    expect(result.workspaceId).toBe(workspaceId);
    expect(memberships).toHaveLength(1);
    expect(invites[0]?.status).toBe('accepted');
    expect(workspacesService.activateWorkspaceForUser).toHaveBeenCalledWith(acceptUserId, workspaceId);
  });

  it('accept is idempotent when user is already a member', async () => {
    const token = createWorkspaceInviteToken();
    const { service, membershipModel, workspacesService } = makeService({
      initialInvites: [
        {
          _id: new Types.ObjectId(),
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: hashWorkspaceInviteToken(token),
          status: 'pending',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
      initialMemberships: [
        { workspaceId: wsOid, userId: new Types.ObjectId(acceptUserId), role: 'member' },
      ],
      isMember: true,
    });

    await service.acceptInviteForUser(token, acceptUserId, 'guest@example.com', now);
    expect(membershipModel.create).not.toHaveBeenCalled();
    expect(workspacesService.activateWorkspaceForUser).toHaveBeenCalled();
  });

  it('accept returns invite_email_mismatch for wrong email', async () => {
    const token = createWorkspaceInviteToken();
    const { service } = makeService({
      initialInvites: [
        {
          _id: new Types.ObjectId(),
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: hashWorkspaceInviteToken(token),
          status: 'pending',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
    });

    await expect(
      service.acceptInviteForUser(token, acceptUserId, 'other@example.com', now),
    ).rejects.toMatchObject({
      response: {
        errorCode: WORKSPACE_INVITE_EMAIL_MISMATCH_CODE,
        invitedEmail: 'guest@example.com',
        currentEmail: 'other@example.com',
      },
    });
  });

  it('accept rechecks member limit for new members', async () => {
    const token = createWorkspaceInviteToken();
    const { service, memberLimitService } = makeService({
      initialInvites: [
        {
          _id: new Types.ObjectId(),
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: hashWorkspaceInviteToken(token),
          status: 'pending',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
      isMember: false,
    });
    (memberLimitService.assertCanInviteMember as jest.Mock).mockRejectedValue(
      new HttpException({ errorCode: 'plan_limit_workspace_members' }, 403),
    );

    await expect(
      service.acceptInviteForUser(token, acceptUserId, 'guest@example.com', now),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('listInvites does not expose tokenHash', async () => {
    const { service } = makeService({
      initialInvites: [
        {
          _id: new Types.ObjectId(),
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: 'secret-hash',
          status: 'pending',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
    });

    const rows = await service.listInvitesForWorkspace(workspaceId);
    expect(rows[0]).toMatchObject({ email: 'guest@example.com', status: 'pending' });
    expect(rows[0]).not.toHaveProperty('tokenHash');
  });

  it('cancel pending invite sets cancelled status', async () => {
    const inviteId = new Types.ObjectId();
    const { service, invites } = makeService({
      initialInvites: [
        {
          _id: inviteId,
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: 'hash',
          status: 'pending',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
    });

    await service.cancelInvite(workspaceId, String(inviteId), now);
    expect(invites[0]?.status).toBe('cancelled');
  });

  it('resend regenerates token for expired invite', async () => {
    const inviteId = new Types.ObjectId();
    const oldHash = 'old-hash';
    const { service, invites } = makeService({
      initialInvites: [
        {
          _id: inviteId,
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: oldHash,
          status: 'pending',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() - 1_000),
        },
      ],
    });

    const result = await service.resendInvite(workspaceId, String(inviteId), now);
    expect(result.plainToken).toBeTruthy();
    expect(invites[0]?.tokenHash).not.toBe(oldHash);
    expect(invites[0]?.status).toBe('pending');
    expect(result.invite.expiresAt.getTime() - now.getTime()).toBe(WORKSPACE_INVITE_DEFAULT_TTL_MS);
  });

  it('cancel is idempotent when already cancelled', async () => {
    const inviteId = new Types.ObjectId();
    const { service } = makeService({
      initialInvites: [
        {
          _id: inviteId,
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: 'hash',
          status: 'cancelled',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
          cancelledAt: now,
        },
      ],
    });

    await expect(service.cancelInvite(workspaceId, String(inviteId), now)).resolves.toBeUndefined();
  });

  it('cancel rejects accepted invite', async () => {
    const inviteId = new Types.ObjectId();
    const { service } = makeService({
      initialInvites: [
        {
          _id: inviteId,
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: 'hash',
          status: 'accepted',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
    });

    await expect(service.cancelInvite(workspaceId, String(inviteId), now)).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_INVITE_ALREADY_ACCEPTED_CODE },
    });
  });

  it('resend rejects cancelled invite', async () => {
    const inviteId = new Types.ObjectId();
    const { service } = makeService({
      initialInvites: [
        {
          _id: inviteId,
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: 'hash',
          status: 'cancelled',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
    });

    await expect(service.resendInvite(workspaceId, String(inviteId), now)).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_INVITE_CANCELLED_CODE },
    });
  });

  it('preview returns workspace_invite_already_accepted', async () => {
    const token = createWorkspaceInviteToken();
    const { service } = makeService({
      initialInvites: [
        {
          _id: new Types.ObjectId(),
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: hashWorkspaceInviteToken(token),
          status: 'accepted',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
    });

    await expect(service.previewInviteByToken(token, now)).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_INVITE_ALREADY_ACCEPTED_CODE },
    });
  });

  it('accept rejects cancelled invite', async () => {
    const token = createWorkspaceInviteToken();
    const { service } = makeService({
      initialInvites: [
        {
          _id: new Types.ObjectId(),
          workspaceId: wsOid,
          email: 'guest@example.com',
          role: 'member',
          tokenHash: hashWorkspaceInviteToken(token),
          status: 'cancelled',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
    });

    await expect(
      service.acceptInviteForUser(token, acceptUserId, 'guest@example.com', now),
    ).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_INVITE_CANCELLED_CODE },
    });
  });

  it('cancel returns not found for unknown invite id', async () => {
    const { service } = makeService();
    await expect(service.cancelInvite(workspaceId, String(new Types.ObjectId()), now)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects duplicate with ConflictException type', async () => {
    const { service } = makeService({
      initialInvites: [
        {
          _id: new Types.ObjectId(),
          workspaceId: wsOid,
          email: 'x@y.com',
          role: 'member',
          tokenHash: 'h',
          status: 'pending',
          invitedByUserId: new Types.ObjectId(invitedByUserId),
          expiresAt: new Date(now.getTime() + 86_400_000),
        },
      ],
    });

    await expect(
      service.createPendingInvite({ workspaceId, email: 'x@y.com', invitedByUserId, now }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
