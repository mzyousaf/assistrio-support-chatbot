import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { CustomerBotsController } from './customer-bots.controller';
import { WorkspaceBotsControllerBase } from './shared/workspace-bots.controller.base';
import { WORKSPACE_ADMIN_REQUIRED_FOR_BOT_CODE } from '../workspaces/workspace-bot-manage.constants';
import {
  WORKSPACE_BOT_ACCESS_DENIED_CODE,
  WORKSPACE_BOT_ACCESS_DENIED_MESSAGE,
} from '../workspaces/workspace-bot-access-grant.util';

class TestCustomerBotsController extends WorkspaceBotsControllerBase {
  protected requiresWorkspaceAdminForMutations(): boolean {
    return true;
  }
}

describe('CustomerBotsController member access', () => {
  const userId = '507f1f77bcf86cd799439012';
  const ownerUserId = '507f1f77bcf86cd799439014';
  const memberUserId = '507f1f77bcf86cd799439013';
  const outsiderUserId = '507f1f77bcf86cd799439015';
  const workspaceId = '507f1f77bcf86cd799439011';
  const botVisibleId = '507f1f77bcf86cd799439020';
  const botHiddenId = '507f1f77bcf86cd799439021';

  const visibleBot = {
    _id: new Types.ObjectId(botVisibleId),
    workspaceId: new Types.ObjectId(workspaceId),
    name: 'Visible agent',
    status: 'published',
    workspaceMemberVisibility: { visibleToMembers: true, allowMemberPreview: true },
  };

  const hiddenBot = {
    _id: new Types.ObjectId(botHiddenId),
    workspaceId: new Types.ObjectId(workspaceId),
    name: 'Hidden agent',
    status: 'draft',
    workspaceMemberVisibility: { visibleToMembers: false, allowMemberPreview: false },
  };

  function buildListController(options?: {
    memberRole?: 'owner' | 'admin' | 'member' | null;
    listBots?: Record<string, unknown>[];
    isWorkspaceMember?: boolean;
  }) {
    const botsService = {
      findForCustomerWorkspaceList: jest.fn().mockResolvedValue(options?.listBots ?? [visibleBot, hiddenBot]),
      getListStatsForBots: jest.fn().mockResolvedValue(new Map()),
    };

    const workspacesService = {
      resolveActiveWorkspaceForUser: jest.fn().mockResolvedValue(workspaceId),
      isUserMemberOfWorkspace: jest.fn().mockResolvedValue(options?.isWorkspaceMember !== false),
      getUserWorkspaceMemberRole: jest.fn().mockResolvedValue(options?.memberRole ?? 'admin'),
      getWorkspaceDisplayName: jest.fn().mockResolvedValue('Acme Workspace'),
      filterWorkspaceBotsForUser: jest.fn(async (_uid, _ws, bots) => {
        if (options?.memberRole === 'member') {
          return (bots as Record<string, unknown>[]).filter(
            (b) => (b as { workspaceMemberVisibility?: { visibleToMembers?: boolean } }).workspaceMemberVisibility?.visibleToMembers !== false,
          );
        }
        return bots;
      }),
    };

    const controller = new CustomerBotsController(
      botsService as never,
      {} as never,
      {} as never,
      {} as never,
      workspacesService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const reqFor = (id: string) => ({ user: { _id: id, role: 'customer' } }) as never;

    return { controller, botsService, workspacesService, reqFor };
  }

  function buildPatchController(options: {
    isAdmin?: boolean;
    isMember?: boolean;
    updateResult?: Record<string, unknown>;
  }) {
    const botDoc = {
      _id: new Types.ObjectId(botVisibleId),
      workspaceId: new Types.ObjectId(workspaceId),
      name: 'Agent',
    };

    const botsService = {
      findOne: jest.fn().mockResolvedValue(botDoc),
      updateWorkspaceMemberVisibility: jest
        .fn()
        .mockResolvedValue(
          options.updateResult ?? {
            ok: true,
            botId: botVisibleId,
            workspaceMemberVisibility: { visibleToMembers: false, allowMemberPreview: true },
          },
        ),
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
    };

    const controller = new TestCustomerBotsController(
      botsService as never,
      {} as never,
      {} as never,
      {} as never,
      workspacesService as never,
      {} as never,
    );

    const adminReq = { user: { _id: ownerUserId, role: 'customer' } } as never;
    const memberReq = { user: { _id: memberUserId, role: 'customer' } } as never;
    const outsiderReq = { user: { _id: outsiderUserId, role: 'customer' } } as never;

    return { controller, botsService, workspacesService, adminReq, memberReq, outsiderReq };
  }

  describe('GET listBots member visibility', () => {
    it('returns all workspace bots for owner', async () => {
      const { controller, reqFor } = buildListController({ memberRole: 'owner' });
      const result = await controller.listBots(reqFor(ownerUserId));
      expect(result).toHaveLength(2);
      expect(result.map((b) => b._id)).toEqual(expect.arrayContaining([botVisibleId, botHiddenId]));
    });

    it('returns all workspace bots for admin', async () => {
      const { controller, reqFor } = buildListController({ memberRole: 'admin' });
      const result = await controller.listBots(reqFor(userId));
      expect(result).toHaveLength(2);
    });

    it('filters hidden bots for workspace members', async () => {
      const { controller, reqFor } = buildListController({ memberRole: 'member' });
      const result = await controller.listBots(reqFor(memberUserId));
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe(botVisibleId);
    });

    it('passes status filter to service and still applies member visibility', async () => {
      const publishedOnly = [visibleBot];
      const { controller, botsService, reqFor } = buildListController({
        memberRole: 'member',
        listBots: publishedOnly,
      });

      const result = await controller.listBots(reqFor(memberUserId), 'published');

      expect(botsService.findForCustomerWorkspaceList).toHaveBeenCalledWith('published', workspaceId);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('published');
    });
  });

  describe('PATCH :id/member-access', () => {
    it('allows owner/admin to update member visibility settings', async () => {
      const { controller, botsService, adminReq } = buildPatchController({ isAdmin: true });
      const body = { workspaceMemberVisibility: { visibleToMembers: false, allowMemberPreview: false } };

      const result = await controller.patchMemberAccess(botVisibleId, body, adminReq);

      expect(botsService.updateWorkspaceMemberVisibility).toHaveBeenCalledWith(botVisibleId, {
        visibleToMembers: false,
        allowMemberPreview: false,
      });
      expect(result).toMatchObject({
        ok: true,
        workspaceMemberVisibility: { visibleToMembers: false, allowMemberPreview: true },
      });
    });

    it('blocks workspace member with workspace_admin_required', async () => {
      const { controller, memberReq } = buildPatchController({ isAdmin: false });

      await expect(
        controller.patchMemberAccess(
          botVisibleId,
          { workspaceMemberVisibility: { visibleToMembers: false } },
          memberReq,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks non-member with 403', async () => {
      const { controller, outsiderReq, workspacesService } = buildPatchController({
        isAdmin: true,
        isMember: false,
      });

      await expect(
        controller.patchMemberAccess(
          botVisibleId,
          { workspaceMemberVisibility: { visibleToMembers: true } },
          outsiderReq,
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { error: 'Forbidden' },
      });
      expect(workspacesService.canUserAccessWorkspaceBot).toHaveBeenCalled();
    });
  });

  describe('GET bot access denied messaging', () => {
    it('uses workspace_bot_access_denied when member cannot access bot', async () => {
      const botDoc = { ...hiddenBot };
      const botsService = { findOne: jest.fn().mockResolvedValue(botDoc) };
      const workspacesService = {
        assertCanAccessWorkspaceBot: jest.fn().mockRejectedValue(
          new ForbiddenException({
            message: WORKSPACE_BOT_ACCESS_DENIED_MESSAGE,
            error: WORKSPACE_BOT_ACCESS_DENIED_MESSAGE,
            errorCode: WORKSPACE_BOT_ACCESS_DENIED_CODE,
          }),
        ),
      };

      const controller = new TestCustomerBotsController(
        botsService as never,
        {} as never,
        {} as never,
        {} as never,
        workspacesService as never,
        {} as never,
      );

      const memberReq = { user: { _id: memberUserId, role: 'customer' } } as never;

      await expect(controller.getBot(botHiddenId, memberReq)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { errorCode: WORKSPACE_BOT_ACCESS_DENIED_CODE },
      });
    });
  });
});
