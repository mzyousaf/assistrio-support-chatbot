import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService active workspace', () => {
  const userId = '507f1f77bcf86cd799439011';
  const wsPersonal = '507f1f77bcf86cd799439012';
  const wsInvited = '507f1f77bcf86cd799439013';
  const uid = new Types.ObjectId(userId);
  const personalOid = new Types.ObjectId(wsPersonal);
  const invitedOid = new Types.ObjectId(wsInvited);

  type UserDoc = { _id: Types.ObjectId; activeWorkspaceId?: Types.ObjectId; role?: string };
  type MembershipDoc = { workspaceId: Types.ObjectId; userId: Types.ObjectId; role: 'admin' | 'member' };
  type WorkspaceDoc = {
    _id: Types.ObjectId;
    name: string;
    createdAt: Date;
    onboardingStatus?: string;
    onboardingCurrentStep?: string;
  };

  function makeService(initial?: {
    user?: UserDoc;
    memberships?: MembershipDoc[];
    workspaces?: WorkspaceDoc[];
  }) {
    let userDoc: UserDoc = initial?.user ?? { _id: uid, role: 'customer' };
    const memberships = [...(initial?.memberships ?? [])];
    const workspaces = [...(initial?.workspaces ?? [])];

    const userModel = {
      findById: jest.fn((id: Types.ObjectId | string) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => {
            if (String(id) === String(uid)) return { ...userDoc };
            return null;
          }),
        })),
        lean: jest.fn(async () => {
          if (String(id) === String(uid)) return { ...userDoc, role: 'customer' };
          return null;
        }),
      })),
      updateOne: jest.fn(async (_filter: unknown, update: { $set?: { activeWorkspaceId?: Types.ObjectId } }) => {
        if (update.$set?.activeWorkspaceId) {
          userDoc = { ...userDoc, activeWorkspaceId: update.$set.activeWorkspaceId };
        }
        return { modifiedCount: 1 };
      }),
    };

    const membershipModel = {
      findOne: jest.fn((filter: { userId?: Types.ObjectId; workspaceId?: Types.ObjectId }) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => {
            const row = memberships.find(
              (m) =>
                String(m.userId) === String(filter.userId) &&
                (filter.workspaceId == null || String(m.workspaceId) === String(filter.workspaceId)),
            );
            return row ?? null;
          }),
        })),
      })),
      find: jest.fn((filter: { userId?: Types.ObjectId }) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () =>
            memberships.filter((m) => String(m.userId) === String(filter.userId)),
          ),
        })),
      })),
      create: jest.fn(async (doc: MembershipDoc) => {
        memberships.push(doc);
        return doc;
      }),
    };

    const workspaceModel = {
      find: jest.fn((filter: { _id?: { $in: Types.ObjectId[] } }) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => {
            const ids = filter._id?.$in?.map(String) ?? [];
            return workspaces.filter((ws) => ids.includes(String(ws._id)));
          }),
        })),
      })),
      create: jest.fn(async (doc: Omit<WorkspaceDoc, '_id'>) => {
        const row: WorkspaceDoc = { _id: new Types.ObjectId(), ...doc };
        workspaces.push(row);
        return row;
      }),
      findOne: jest.fn(),
    };

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

    return {
      service,
      userModel,
      workspaceModel,
      getUser: () => userDoc,
      memberships,
      workspaces,
    };
  }

  it('resolveActiveWorkspaceForUser keeps valid stored activeWorkspaceId', async () => {
    const { service } = makeService({
      user: { _id: uid, activeWorkspaceId: invitedOid },
      memberships: [
        { userId: uid, workspaceId: personalOid, role: 'admin' },
        { userId: uid, workspaceId: invitedOid, role: 'member' },
      ],
      workspaces: [
        { _id: personalOid, name: 'Personal', createdAt: new Date('2024-01-01') },
        { _id: invitedOid, name: 'Team', createdAt: new Date('2025-01-01') },
      ],
    });

    await expect(service.resolveActiveWorkspaceForUser(userId)).resolves.toBe(wsInvited);
  });

  it('resolveActiveWorkspaceForUser falls back and persists when stored id is invalid', async () => {
    const invalid = new Types.ObjectId();
    const { service, getUser } = makeService({
      user: { _id: uid, activeWorkspaceId: invalid },
      memberships: [{ userId: uid, workspaceId: personalOid, role: 'admin' }],
      workspaces: [{ _id: personalOid, name: 'Personal', createdAt: new Date('2024-01-01') }],
    });

    await expect(service.resolveActiveWorkspaceForUser(userId)).resolves.toBe(wsPersonal);
    expect(String(getUser().activeWorkspaceId)).toBe(wsPersonal);
  });

  it('resolveActiveWorkspaceForUser falls back deterministically when activeWorkspaceId missing', async () => {
    const { service, getUser } = makeService({
      memberships: [
        { userId: uid, workspaceId: invitedOid, role: 'member' },
        { userId: uid, workspaceId: personalOid, role: 'admin' },
      ],
      workspaces: [
        { _id: invitedOid, name: 'Team', createdAt: new Date('2023-01-01') },
        { _id: personalOid, name: 'Personal', createdAt: new Date('2025-01-01') },
      ],
    });

    await expect(service.resolveActiveWorkspaceForUser(userId)).resolves.toBe(wsPersonal);
    expect(String(getUser().activeWorkspaceId)).toBe(wsPersonal);
  });

  it('ensurePersonalWorkspaceForUser sets activeWorkspaceId when creating first workspace', async () => {
    const { service, getUser, workspaceModel, userModel } = makeService({
      memberships: [],
      workspaces: [],
    });

    const createdId = await service.ensurePersonalWorkspaceForUser(userId);

    expect(createdId).toBeTruthy();
    expect(workspaceModel.create).toHaveBeenCalled();
    expect(userModel.updateOne).toHaveBeenCalledWith(
      { _id: uid },
      { $set: { activeWorkspaceId: expect.any(Types.ObjectId) } },
    );
    expect(getUser().activeWorkspaceId).toBeTruthy();
  });

  it('ensurePersonalWorkspaceForUser does not override activeWorkspaceId when memberships exist', async () => {
    const stored = invitedOid;
    const { service, getUser, userModel } = makeService({
      user: { _id: uid, activeWorkspaceId: stored },
      memberships: [{ userId: uid, workspaceId: personalOid, role: 'admin' }],
      workspaces: [{ _id: personalOid, name: 'Personal', createdAt: new Date('2024-01-01') }],
    });

    await service.ensurePersonalWorkspaceForUser(userId);

    expect(String(getUser().activeWorkspaceId)).toBe(String(stored));
    expect(userModel.updateOne).not.toHaveBeenCalled();
  });

  it('getWorkspacesSummaryForUser puts active workspace first and includes role', async () => {
    const { service } = makeService({
      memberships: [
        { userId: uid, workspaceId: personalOid, role: 'admin' },
        { userId: uid, workspaceId: invitedOid, role: 'member' },
      ],
      workspaces: [
        {
          _id: personalOid,
          name: 'Personal',
          createdAt: new Date('2024-01-01'),
          onboardingStatus: 'not_started',
          onboardingCurrentStep: 'agent-profile',
        },
        {
          _id: invitedOid,
          name: 'Team',
          createdAt: new Date('2025-01-01'),
          onboardingStatus: 'completed',
          onboardingCurrentStep: 'go-live',
        },
      ],
    });

    const summaries = await service.getWorkspacesSummaryForUser(userId, wsInvited);
    expect(summaries.map((row) => row.id)).toEqual([wsInvited, wsPersonal]);
    expect(summaries[0]).toMatchObject({ id: wsInvited, role: 'member' });
    expect(summaries[1]).toMatchObject({ id: wsPersonal, role: 'admin' });
  });

  it('activateWorkspaceForUser sets active workspace for members', async () => {
    const { service, getUser } = makeService({
      memberships: [{ userId: uid, workspaceId: invitedOid, role: 'member' }],
      workspaces: [{ _id: invitedOid, name: 'Team', createdAt: new Date('2025-01-01') }],
    });

    await service.activateWorkspaceForUser(userId, wsInvited);
    expect(String(getUser().activeWorkspaceId)).toBe(wsInvited);
  });

  it('activateWorkspaceForUser rejects non-members', async () => {
    const { service } = makeService({
      memberships: [{ userId: uid, workspaceId: personalOid, role: 'admin' }],
      workspaces: [{ _id: personalOid, name: 'Personal', createdAt: new Date('2024-01-01') }],
    });

    await expect(service.activateWorkspaceForUser(userId, wsInvited)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
