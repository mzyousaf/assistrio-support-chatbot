import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WorkspaceBotsControllerBase } from './shared/workspace-bots.controller.base';
import { WORKSPACE_ADMIN_REQUIRED_FOR_BOT_CODE } from '../workspaces/workspace-bot-manage.constants';

class TestCustomerBotsController extends WorkspaceBotsControllerBase {
  protected requiresWorkspaceAdminForMutations(): boolean {
    return true;
  }
}

describe('Customer bot manage guards', () => {
  const botId = '507f1f77bcf86cd799439020';
  const workspaceId = '507f1f77bcf86cd799439011';
  const adminUserId = '507f1f77bcf86cd799439012';
  const memberUserId = '507f1f77bcf86cd799439013';

  const botDoc = {
    _id: new Types.ObjectId(botId),
    workspaceId: new Types.ObjectId(workspaceId),
    name: 'Agent',
    status: 'draft',
  };

  function buildController(options: { isAdmin?: boolean; isMember?: boolean }) {
    const botsService = {
      findOne: jest.fn().mockResolvedValue(botDoc),
      findByIdAny: jest.fn().mockResolvedValue(botDoc),
      updateWorkspaceBot: jest.fn().mockResolvedValue({ ok: true }),
      remove: jest.fn().mockResolvedValue(undefined),
      findOneWorkspaceForAdmin: jest.fn().mockResolvedValue(botDoc),
      getListStatsForBots: jest.fn().mockResolvedValue(new Map()),
    };

    const workspacesService = {
      canUserAccessWorkspaceBot: jest.fn().mockResolvedValue(options.isMember !== false),
      assertCanManageWorkspaceBot:
        options.isAdmin === false
          ? jest.fn().mockRejectedValue(
              new ForbiddenException({
                message: 'Only workspace admins can manage agents.',
                error: 'Only workspace admins can manage agents.',
                errorCode: WORKSPACE_ADMIN_REQUIRED_FOR_BOT_CODE,
              }),
            )
          : jest.fn().mockResolvedValue(undefined),
      canUserManageWorkspaceBot: jest.fn().mockResolvedValue(options.isAdmin !== false),
    };

    const controller = new TestCustomerBotsController(
      botsService as never,
      {} as never,
      {} as never,
      {} as never,
      workspacesService as never,
      {} as never,
    );

    const adminReq = { user: { _id: adminUserId, role: 'customer' } } as never;
    const memberReq = { user: { _id: memberUserId, role: 'customer' } } as never;

    return { controller, botsService, workspacesService, adminReq, memberReq };
  }

  it('allows admin to PATCH bot', async () => {
    const { controller, adminReq } = buildController({ isAdmin: true });
    await expect(controller.patchBot(botId, { name: 'Updated' }, adminReq)).resolves.toEqual({ ok: true });
  });

  it('blocks member from PATCH bot', async () => {
    const { controller, memberReq } = buildController({ isAdmin: false });
    await expect(controller.patchBot(botId, { name: 'Updated' }, memberReq)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('blocks member from DELETE bot', async () => {
    const { controller, memberReq } = buildController({ isAdmin: false });
    await expect(controller.deleteBot(botId, memberReq)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admin to DELETE bot', async () => {
    const { controller, botsService, adminReq } = buildController({ isAdmin: true });
    await expect(controller.deleteBot(botId, adminReq)).resolves.toMatchObject({ ok: true, deleted: botId });
    expect(botsService.remove).toHaveBeenCalledWith(botId);
  });
});
