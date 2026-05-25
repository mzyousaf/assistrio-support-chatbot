import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WorkspacesService } from './workspaces.service';
import {
  WORKSPACE_LAST_MANAGER_REQUIRED_CODE,
  WORKSPACE_OWNER_PROTECTED_CODE,
} from '../models/workspace-invite.constants';

describe('WorkspacesService member removal', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const ownerUserId = '507f1f77bcf86cd799439010';
  const adminUserId = '507f1f77bcf86cd799439012';
  const memberUserId = '507f1f77bcf86cd799439013';
  const wsOid = new Types.ObjectId(workspaceId);
  const ownerOid = new Types.ObjectId(ownerUserId);
  const adminOid = new Types.ObjectId(adminUserId);
  const memberOid = new Types.ObjectId(memberUserId);

  function makeService(initial?: {
    memberships?: Array<{ _id?: Types.ObjectId; workspaceId: Types.ObjectId; userId: Types.ObjectId; role: string }>;
    activeWorkspaceId?: Types.ObjectId;
  }) {
    const memberships = [...(initial?.memberships ?? [])];
    let userDoc = {
      _id: memberOid,
      activeWorkspaceId: initial?.activeWorkspaceId,
    };

    const membershipModel = {
      findOne: jest.fn((filter: { workspaceId?: Types.ObjectId; userId?: Types.ObjectId; role?: string }) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => {
            const match =
              memberships.find(
                (row) =>
                  String(row.workspaceId) === String(filter.workspaceId) &&
                  String(row.userId) === String(filter.userId) &&
                  (!filter.role || row.role === filter.role),
              ) ?? null;
            return match ? { _id: match._id ?? new Types.ObjectId(), role: match.role } : null;
          }),
        })),
      })),
      find: jest.fn((filter: { workspaceId?: Types.ObjectId; userId?: Types.ObjectId }) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () =>
            memberships.filter(
              (row) =>
                (filter.workspaceId == null || String(row.workspaceId) === String(filter.workspaceId)) &&
                (filter.userId == null || String(row.userId) === String(filter.userId)),
            ),
          ),
        })),
      })),
      countDocuments: jest.fn((filter: { workspaceId?: Types.ObjectId; role?: string | { $in: string[] } }) => ({
        exec: jest.fn(async () =>
          memberships.filter((row) => {
            if (String(row.workspaceId) !== String(filter.workspaceId)) return false;
            if (filter.role == null) return true;
            if (typeof filter.role === 'string') return row.role === filter.role;
            if (Array.isArray(filter.role.$in)) return filter.role.$in.includes(row.role);
            return false;
          }).length,
        ),
      })),
      deleteOne: jest.fn(async (filter: { workspaceId: Types.ObjectId; userId: Types.ObjectId }) => {
        const idx = memberships.findIndex(
          (row) =>
            String(row.workspaceId) === String(filter.workspaceId) &&
            String(row.userId) === String(filter.userId),
        );
        if (idx >= 0) memberships.splice(idx, 1);
        return { deletedCount: idx >= 0 ? 1 : 0 };
      }),
    };

    const userModel = {
      findById: jest.fn((id: Types.ObjectId | string) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => (String(id) === memberUserId ? { ...userDoc, _id: memberOid } : null)),
        })),
        lean: jest.fn(async () => ({ role: 'customer' })),
      })),
      updateOne: jest.fn(async (_filter: unknown, update: { $unset?: { activeWorkspaceId: string } }) => {
        if (update.$unset?.activeWorkspaceId !== undefined) {
          userDoc = { ...userDoc, activeWorkspaceId: undefined };
        }
        return { modifiedCount: 1 };
      }),
      find: jest.fn(),
      create: jest.fn(),
    };

    const workspaceModel = { find: jest.fn(), create: jest.fn(), findOne: jest.fn() };
    const workspaceSubscriptionsService = {
      ensureFreeSubscriptionForWorkspace: jest.fn().mockResolvedValue(undefined),
    };

    const service = new WorkspacesService(
      userModel as never,
      workspaceModel as never,
      membershipModel as never,
      {} as never,
      workspaceSubscriptionsService as never,
      {} as never,
    );

    return { service, membershipModel, getUserDoc: () => userDoc, memberships };
  }

  it('removeWorkspaceMember clears activeWorkspaceId when it matches removed workspace', async () => {
    const { service, getUserDoc, memberships } = makeService({
      memberships: [
        { workspaceId: wsOid, userId: ownerOid, role: 'owner' },
        { workspaceId: wsOid, userId: memberOid, role: 'member' },
      ],
      activeWorkspaceId: wsOid,
    });

    await service.removeWorkspaceMember(workspaceId, memberUserId, ownerUserId);

    expect(getUserDoc().activeWorkspaceId).toBeUndefined();
    expect(memberships).toHaveLength(1);
  });

  it('blocks removing workspace owner', async () => {
    const { service } = makeService({
      memberships: [
        { workspaceId: wsOid, userId: ownerOid, role: 'owner' },
        { workspaceId: wsOid, userId: adminOid, role: 'admin' },
      ],
    });

    await expect(service.removeWorkspaceMember(workspaceId, ownerUserId, adminUserId)).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_OWNER_PROTECTED_CODE },
    });
  });

  it('allows owner to remove admin when owner exists', async () => {
    const { service, memberships } = makeService({
      memberships: [
        { workspaceId: wsOid, userId: ownerOid, role: 'owner' },
        { workspaceId: wsOid, userId: adminOid, role: 'admin' },
      ],
    });

    await service.removeWorkspaceMember(workspaceId, adminUserId, ownerUserId);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe('owner');
  });

  it('blocks removing last manager when workspace has no owner', async () => {
    const { service } = makeService({
      memberships: [{ workspaceId: wsOid, userId: adminOid, role: 'admin' }],
    });

    await expect(service.removeWorkspaceMember(workspaceId, adminUserId, adminUserId)).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_LAST_MANAGER_REQUIRED_CODE },
    });
  });

  it('member cannot remove anyone', async () => {
    const { service } = makeService({
      memberships: [
        { workspaceId: wsOid, userId: ownerOid, role: 'owner' },
        { workspaceId: wsOid, userId: memberOid, role: 'member' },
      ],
    });

    await expect(service.removeWorkspaceMember(workspaceId, memberUserId, memberUserId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('assertWorkspaceAdmin throws workspace_access_denied for member', async () => {
    const { service } = makeService({
      memberships: [{ workspaceId: wsOid, userId: memberOid, role: 'member' }],
    });

    await expect(service.assertWorkspaceAdmin(memberUserId, workspaceId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
