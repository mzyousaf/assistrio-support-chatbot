import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WorkspaceMembership } from '../models/workspace-membership.schema';
import {
  assertWorkspaceAdmin,
  assertWorkspaceManager,
  assertWorkspaceOwner,
  countWorkspaceAdmins,
  countWorkspaceManagers,
  countWorkspaceOwners,
  isWorkspaceAdmin,
  isWorkspaceManager,
  isWorkspaceOwner,
} from './workspace-membership-admin.util';

describe('workspace-membership-admin.util', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const ownerUserId = '507f1f77bcf86cd799439010';
  const adminUserId = '507f1f77bcf86cd799439012';
  const memberUserId = '507f1f77bcf86cd799439013';

  function makeMembershipModel(rows: Array<{ userId: string; role: string }>) {
    return {
      countDocuments: jest.fn((filter: { workspaceId: Types.ObjectId; role?: string | { $in: string[] } }) => ({
        exec: jest.fn(async () => {
          const ws = String(filter.workspaceId);
          return rows.filter((row) => {
            if (filter.role == null) return true;
            if (typeof filter.role === 'string') return row.role === filter.role;
            if (Array.isArray(filter.role.$in)) return filter.role.$in.includes(row.role);
            return false;
          }).length;
        }),
      })),
      findOne: jest.fn((filter: { userId: Types.ObjectId; workspaceId: Types.ObjectId; role?: string }) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => {
            const match = rows.find(
              (row) =>
                row.userId === String(filter.userId) &&
                (!filter.role || row.role === filter.role),
            );
            return match ? { _id: new Types.ObjectId(), role: match.role } : null;
          }),
        })),
      })),
    } as unknown as import('mongoose').Model<WorkspaceMembership>;
  }

  it('countWorkspaceManagers returns owner and admin count', async () => {
    const model = makeMembershipModel([
      { userId: ownerUserId, role: 'owner' },
      { userId: adminUserId, role: 'admin' },
      { userId: memberUserId, role: 'member' },
    ]);
    await expect(countWorkspaceManagers(model, workspaceId)).resolves.toBe(2);
    await expect(countWorkspaceAdmins(model, workspaceId)).resolves.toBe(1);
    await expect(countWorkspaceOwners(model, workspaceId)).resolves.toBe(1);
  });

  it('isWorkspaceManager is true for owner and admin', async () => {
    const model = makeMembershipModel([
      { userId: ownerUserId, role: 'owner' },
      { userId: adminUserId, role: 'admin' },
      { userId: memberUserId, role: 'member' },
    ]);
    await expect(isWorkspaceManager(model, ownerUserId, workspaceId)).resolves.toBe(true);
    await expect(isWorkspaceManager(model, adminUserId, workspaceId)).resolves.toBe(true);
    await expect(isWorkspaceManager(model, memberUserId, workspaceId)).resolves.toBe(false);
  });

  it('isWorkspaceAdmin alias passes for owner and admin', async () => {
    const model = makeMembershipModel([
      { userId: ownerUserId, role: 'owner' },
      { userId: memberUserId, role: 'member' },
    ]);
    await expect(isWorkspaceAdmin(model, ownerUserId, workspaceId)).resolves.toBe(true);
    await expect(isWorkspaceAdmin(model, memberUserId, workspaceId)).resolves.toBe(false);
  });

  it('isWorkspaceOwner is true only for owner role', async () => {
    const model = makeMembershipModel([
      { userId: ownerUserId, role: 'owner' },
      { userId: adminUserId, role: 'admin' },
    ]);
    await expect(isWorkspaceOwner(model, ownerUserId, workspaceId)).resolves.toBe(true);
    await expect(isWorkspaceOwner(model, adminUserId, workspaceId)).resolves.toBe(false);
  });

  it('assertWorkspaceManager throws for member', async () => {
    const model = makeMembershipModel([{ userId: memberUserId, role: 'member' }]);
    await expect(assertWorkspaceManager(model, memberUserId, workspaceId)).rejects.toMatchObject({
      response: { errorCode: 'workspace_access_denied' },
    });
  });

  it('assertWorkspaceAdmin throws for non-manager', async () => {
    const model = makeMembershipModel([{ userId: memberUserId, role: 'member' }]);
    await expect(assertWorkspaceAdmin(model, memberUserId, workspaceId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('assertWorkspaceOwner throws for admin', async () => {
    const model = makeMembershipModel([{ userId: adminUserId, role: 'admin' }]);
    await expect(assertWorkspaceOwner(model, adminUserId, workspaceId)).rejects.toMatchObject({
      response: { errorCode: 'workspace_owner_required' },
    });
  });
});
