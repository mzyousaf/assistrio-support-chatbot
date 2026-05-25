import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WorkspacesService } from './workspaces.service';
import {
  WORKSPACE_ADMIN_REQUIRED_FOR_BOT_CODE,
  WORKSPACE_ADMIN_REQUIRED_FOR_BOT_MESSAGE,
} from './workspace-bot-manage.constants';

describe('WorkspacesService bot manage access', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const ownerUserId = '507f1f77bcf86cd799439010';
  const adminUserId = '507f1f77bcf86cd799439012';
  const memberUserId = '507f1f77bcf86cd799439013';
  const legacyBotOwnerUserId = '507f1f77bcf86cd799439014';

  function buildService(roleByUserId: Record<string, string | null>) {
    const membershipModel = {
      findOne: jest.fn(({ userId }: { userId: Types.ObjectId }) => ({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(() => {
            const role = roleByUserId[String(userId)];
            return role ? { _id: new Types.ObjectId(), role } : null;
          }),
        }),
      })),
    };

    membershipModel.findOne.mockImplementation(({ userId }: { userId: Types.ObjectId }) => ({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(() => {
          const role = roleByUserId[String(userId)];
          return role ? { _id: new Types.ObjectId(), role } : null;
        }),
      }),
    }));

    // Fix mock - lean should return promise directly
    membershipModel.findOne.mockImplementation(({ userId }: { userId: Types.ObjectId }) => {
      const role = roleByUserId[String(userId)];
      return {
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(role ? { _id: new Types.ObjectId(), role } : null),
        }),
      };
    });

    const service = new WorkspacesService(
      {} as never,
      {} as never,
      membershipModel as never,
      {} as never,
      {} as never,
      {} as never,
    );

    return { service, membershipModel };
  }

  it('allows workspace owner to manage bot', async () => {
    const { service } = buildService({ [ownerUserId]: 'owner' });
    await expect(
      service.assertCanManageWorkspaceBot(ownerUserId, 'customer', {
        workspaceId: new Types.ObjectId(workspaceId),
      }),
    ).resolves.toBeUndefined();
  });

  it('allows workspace admin to manage bot', async () => {
    const { service } = buildService({ [adminUserId]: 'admin' });
    await expect(
      service.assertCanManageWorkspaceBot(adminUserId, 'customer', {
        workspaceId: new Types.ObjectId(workspaceId),
      }),
    ).resolves.toBeUndefined();
  });

  it('blocks workspace member from managing bot', async () => {
    const { service } = buildService({ [memberUserId]: 'member' });
    await expect(
      service.assertCanManageWorkspaceBot(memberUserId, 'customer', {
        workspaceId: new Types.ObjectId(workspaceId),
      }),
    ).rejects.toMatchObject({
      response: {
        errorCode: WORKSPACE_ADMIN_REQUIRED_FOR_BOT_CODE,
        message: WORKSPACE_ADMIN_REQUIRED_FOR_BOT_MESSAGE,
      },
    });
  });

  it('allows legacy owner to manage bot without workspaceId', async () => {
    const { service } = buildService({});
    await expect(
      service.canUserManageWorkspaceBot(legacyBotOwnerUserId, 'customer', {
        ownerId: new Types.ObjectId(legacyBotOwnerUserId),
      }),
    ).resolves.toBe(true);
  });

  it('allows superadmin to manage any bot', async () => {
    const { service } = buildService({ [memberUserId]: 'member' });
    await expect(
      service.canUserManageWorkspaceBot(memberUserId, 'superadmin', {
        workspaceId: new Types.ObjectId(workspaceId),
      }),
    ).resolves.toBe(true);
  });

  it('assertCanManageWorkspaceBot throws ForbiddenException for member', async () => {
    const { service } = buildService({ [memberUserId]: 'member' });
    await expect(
      service.assertCanManageWorkspaceBot(memberUserId, 'customer', {
        workspaceId: new Types.ObjectId(workspaceId),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
