import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CustomerWorkspaceController } from './customer-workspace.controller';
import {
  WORKSPACE_DELETE_PAID_REQUIRED_CODE,
  WORKSPACE_DELETE_PLATFORM_FORBIDDEN_CODE,
} from '../workspaces/workspace-delete.constants';

describe('CustomerWorkspaceController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const ownerUserId = '507f1f77bcf86cd799439012';

  const ownerReq = {
    user: { _id: ownerUserId, email: 'owner@example.com', role: 'customer' },
  } as never;

  function buildController(options?: {
    updateError?: Error;
    deleteError?: Error;
  }) {
    const workspacesService = {
      updateWorkspaceName: options?.updateError
        ? jest.fn().mockRejectedValue(options.updateError)
        : jest.fn().mockResolvedValue({ id: workspaceId, name: 'Renamed Workspace' }),
      deleteWorkspaceForOwner: options?.deleteError
        ? jest.fn().mockRejectedValue(options.deleteError)
        : jest.fn().mockResolvedValue(undefined),
    };
    const entitlementsService = {
      resolveForWorkspace: jest.fn(),
    };
    const controller = new CustomerWorkspaceController(
      workspacesService as never,
      entitlementsService as never,
    );
    return { controller, workspacesService };
  }

  it('owner/admin can patch workspace name and returns session', async () => {
    const { controller, workspacesService } = buildController();
    const session = { id: ownerUserId, activeWorkspaceId: workspaceId, workspaces: [] };
    jest.spyOn(require('../auth/customer/customer-session.payload'), 'buildCustomerSessionPayload').mockResolvedValue(session);

    const result = await controller.patchWorkspace(ownerReq, workspaceId, { name: 'Renamed Workspace' });
    expect(workspacesService.updateWorkspaceName).toHaveBeenCalledWith(
      workspaceId,
      ownerUserId,
      'Renamed Workspace',
    );
    expect(result.workspace.name).toBe('Renamed Workspace');
    expect(result.session).toEqual(session);
  });

  it('rejects empty workspace name patch body field', async () => {
    const { controller } = buildController();
    await expect(controller.patchWorkspace(ownerReq, workspaceId, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('owner can delete paid workspace and returns session', async () => {
    const { controller, workspacesService } = buildController();
    const session = { id: ownerUserId, activeWorkspaceId: null, workspaces: [] };
    jest.spyOn(require('../auth/customer/customer-session.payload'), 'buildCustomerSessionPayload').mockResolvedValue(session);

    const result = await controller.deleteWorkspace(ownerReq, workspaceId);
    expect(workspacesService.deleteWorkspaceForOwner).toHaveBeenCalledWith(workspaceId, ownerUserId);
    expect(result.success).toBe(true);
    expect(result.session).toEqual(session);
  });

  it('propagates paid-plan requirement for delete', async () => {
    const { controller } = buildController({
      deleteError: new ForbiddenException({
        errorCode: WORKSPACE_DELETE_PAID_REQUIRED_CODE,
      }),
    });
    await expect(controller.deleteWorkspace(ownerReq, workspaceId)).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_DELETE_PAID_REQUIRED_CODE },
    });
  });

  it('propagates platform workspace delete block', async () => {
    const { controller } = buildController({
      deleteError: new ForbiddenException({
        errorCode: WORKSPACE_DELETE_PLATFORM_FORBIDDEN_CODE,
      }),
    });
    await expect(controller.deleteWorkspace(ownerReq, workspaceId)).rejects.toMatchObject({
      response: { errorCode: WORKSPACE_DELETE_PLATFORM_FORBIDDEN_CODE },
    });
  });
});
