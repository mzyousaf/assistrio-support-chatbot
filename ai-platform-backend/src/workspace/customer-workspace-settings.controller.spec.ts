import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CustomerWorkspaceSettingsController } from './customer-workspace-settings.controller';

describe('CustomerWorkspaceSettingsController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const ownerUserId = '507f1f77bcf86cd799439010';
  const adminUserId = '507f1f77bcf86cd799439013';

  function buildController(options?: { isAdmin?: boolean; isOwner?: boolean }) {
    const workspacesService = {
      assertWorkspaceAdmin:
        options?.isAdmin === false
          ? jest.fn().mockRejectedValue(new ForbiddenException({ errorCode: 'workspace_access_denied' }))
          : jest.fn().mockResolvedValue(undefined),
      getWorkspaceSettings: jest.fn().mockResolvedValue({
        defaultBotAccessPolicy: {
          grantViewToWorkspacePeopleOnCreate: false,
          grantPreviewToWorkspacePeopleOnCreate: false,
        },
      }),
      updateWorkspaceDefaultBotAccessPolicy: jest.fn().mockResolvedValue({
        defaultBotAccessPolicy: {
          grantViewToWorkspacePeopleOnCreate: true,
          grantPreviewToWorkspacePeopleOnCreate: false,
        },
      }),
    };

    const controller = new CustomerWorkspaceSettingsController(workspacesService as never);
    return { controller, workspacesService };
  }

  const ownerReq = {
    user: { _id: ownerUserId, email: 'owner@example.com', role: 'customer' },
  } as never;

  it('admin can GET settings', async () => {
    const { controller, workspacesService } = buildController();
    const result = await controller.getSettings(ownerReq, workspaceId);
    expect(workspacesService.assertWorkspaceAdmin).toHaveBeenCalledWith(ownerUserId, workspaceId);
    expect(result.defaultBotAccessPolicy).toBeDefined();
  });

  it('owner can PATCH settings', async () => {
    const { controller, workspacesService } = buildController();
    const result = await controller.patchSettings(ownerReq, workspaceId, {
      defaultBotAccessPolicy: {
        grantViewToWorkspacePeopleOnCreate: true,
        grantPreviewToWorkspacePeopleOnCreate: false,
      },
    });
    expect(workspacesService.updateWorkspaceDefaultBotAccessPolicy).toHaveBeenCalled();
    expect(result.defaultBotAccessPolicy.grantViewToWorkspacePeopleOnCreate).toBe(true);
  });

  it('rejects invalid PATCH body', async () => {
    const { controller } = buildController();
    await expect(controller.patchSettings(ownerReq, workspaceId, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('non-admin cannot GET settings', async () => {
    const { controller } = buildController({ isAdmin: false });
    await expect(controller.getSettings(ownerReq, workspaceId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
