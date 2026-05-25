import { Types } from 'mongoose';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService workspace creation', () => {
  function makeService() {
    const createdMemberships: Array<{ workspaceId: Types.ObjectId; userId: Types.ObjectId; role: string }> = [];

    const userModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          role: 'customer',
          firstName: 'Ada',
          lastName: 'Lovelace',
        }),
      }),
    };

    const workspaceModel = {
      create: jest.fn().mockImplementation(async (doc: { name: string }) => ({
        _id: new Types.ObjectId('507f1f77bcf86cd799439099'),
        ...doc,
      })),
    };

    const membershipModel = {
      create: jest.fn().mockImplementation(async (doc: { workspaceId: Types.ObjectId; userId: Types.ObjectId; role: string }) => {
        createdMemberships.push(doc);
        return doc;
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

    return { service, createdMemberships, membershipModel, userModel };
  }

  it('createWorkspaceWithOwnerMember creates owner membership', async () => {
    const userId = new Types.ObjectId('507f1f77bcf86cd799439012');
    const { service, createdMemberships } = makeService();

    await service.createWorkspaceWithOwnerMember(userId);

    expect(createdMemberships).toHaveLength(1);
    expect(createdMemberships[0]?.role).toBe('owner');
    expect(String(createdMemberships[0]?.userId)).toBe(String(userId));
  });

  it('createWorkspaceWithAdminMember alias creates owner membership', async () => {
    const userId = new Types.ObjectId('507f1f77bcf86cd799439012');
    const { service, createdMemberships } = makeService();

    await service.createWorkspaceWithAdminMember(userId);

    expect(createdMemberships[0]?.role).toBe('owner');
  });

  it('ensurePersonalWorkspaceForUser does not overwrite existing membership', async () => {
    const userId = '507f1f77bcf86cd799439012';
    const existingWs = new Types.ObjectId('507f1f77bcf86cd799439011');
    const { service, membershipModel } = makeService();

    membershipModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ workspaceId: existingWs }),
      }),
    });

    const result = await service.ensurePersonalWorkspaceForUser(userId);

    expect(String(result)).toBe(String(existingWs));
    expect(membershipModel.create).not.toHaveBeenCalled();
  });
});
