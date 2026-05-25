import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceBotAccessGrantService } from './workspace-bot-access-grant.service';

describe('WorkspaceBotAccessGrantService applyDefaultAccessGrantsForNewBot', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const botId = '507f1f77bcf86cd799439012';
  const ownerUserId = '507f1f77bcf86cd799439010';
  const adminUserId = '507f1f77bcf86cd799439013';
  const memberUserId = '507f1f77bcf86cd799439014';
  const creatorUserId = '507f1f77bcf86cd799439010';

  function buildService() {
    const upsertGrantsForBot = jest.fn().mockResolvedValue([]);
    const membershipModel = {
      find: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue([
            { userId: new Types.ObjectId(ownerUserId), role: 'owner' },
            { userId: new Types.ObjectId(adminUserId), role: 'admin' },
            { userId: new Types.ObjectId(memberUserId), role: 'member' },
          ]),
        })),
      })),
    };

    const service = new WorkspaceBotAccessGrantService(
      {} as never,
      membershipModel as never,
      {} as never,
      {} as never,
    );
    service.upsertGrantsForBot = upsertGrantsForBot;

    return { service, upsertGrantsForBot };
  }

  it('creates grants for active non-owner members when view default is on', async () => {
    const { service, upsertGrantsForBot } = buildService();
    await service.applyDefaultAccessGrantsForNewBot({
      workspaceId,
      botId,
      createdByUserId: creatorUserId,
      policy: {
        grantViewToWorkspacePeopleOnCreate: true,
        grantPreviewToWorkspacePeopleOnCreate: false,
      },
    });

    expect(upsertGrantsForBot).toHaveBeenCalledWith({
      workspaceId,
      botId,
      createdByUserId: creatorUserId,
      grants: [
        { subjectType: 'user', userId: adminUserId, canView: true, canPreview: false },
        { subjectType: 'user', userId: memberUserId, canView: true, canPreview: false },
      ],
    });
  });

  it('creates preview grants when preview default is on', async () => {
    const { service, upsertGrantsForBot } = buildService();
    await service.applyDefaultAccessGrantsForNewBot({
      workspaceId,
      botId,
      createdByUserId: creatorUserId,
      policy: {
        grantViewToWorkspacePeopleOnCreate: true,
        grantPreviewToWorkspacePeopleOnCreate: true,
      },
    });

    expect(upsertGrantsForBot).toHaveBeenCalledWith(
      expect.objectContaining({
        grants: expect.arrayContaining([
          { subjectType: 'user', userId: adminUserId, canView: true, canPreview: true },
          { subjectType: 'user', userId: memberUserId, canView: true, canPreview: true },
        ]),
      }),
    );
  });

  it('skips when policy is off', async () => {
    const { service, upsertGrantsForBot } = buildService();
    await service.applyDefaultAccessGrantsForNewBot({
      workspaceId,
      botId,
      createdByUserId: creatorUserId,
      policy: {
        grantViewToWorkspacePeopleOnCreate: false,
        grantPreviewToWorkspacePeopleOnCreate: false,
      },
    });
    expect(upsertGrantsForBot).not.toHaveBeenCalled();
  });
});

describe('WorkspacesService workspace settings', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const ownerUserId = '507f1f77bcf86cd799439010';
  const adminUserId = '507f1f77bcf86cd799439013';

  function buildWorkspacesService() {
    const workspaceModel = {
      findById: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue({
            defaultBotAccessPolicy: {
              grantViewToWorkspacePeopleOnCreate: true,
              grantPreviewToWorkspacePeopleOnCreate: false,
            },
          }),
        })),
      })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const membershipModel = {
      findOne: jest.fn((filter: { userId: Types.ObjectId }) => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => {
            const uid = String(filter.userId);
            if (uid === ownerUserId) return { role: 'owner' };
            if (uid === adminUserId) return { role: 'admin' };
            return null;
          }),
        })),
      })),
    };

    const service = new WorkspacesService(
      {} as never,
      workspaceModel as never,
      membershipModel as never,
      {} as never,
      {} as never,
      { applyDefaultAccessGrantsForNewBot: jest.fn() } as never,
    );
    return { service, workspaceModel };
  }

  it('owner can update default policy', async () => {
    const { service } = buildWorkspacesService();
    const result = await service.updateWorkspaceDefaultBotAccessPolicy(workspaceId, ownerUserId, {
      grantViewToWorkspacePeopleOnCreate: false,
      grantPreviewToWorkspacePeopleOnCreate: true,
    });
    expect(result.defaultBotAccessPolicy).toEqual({
      grantViewToWorkspacePeopleOnCreate: true,
      grantPreviewToWorkspacePeopleOnCreate: true,
    });
  });

  it('admin cannot update default policy', async () => {
    const { service } = buildWorkspacesService();
    await expect(
      service.updateWorkspaceDefaultBotAccessPolicy(workspaceId, adminUserId, {
        grantViewToWorkspacePeopleOnCreate: true,
        grantPreviewToWorkspacePeopleOnCreate: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
