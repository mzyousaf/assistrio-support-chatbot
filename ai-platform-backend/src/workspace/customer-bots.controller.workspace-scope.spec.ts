import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { CustomerBotsController } from './customer-bots.controller';

describe('CustomerBotsController workspace scope', () => {
  const userId = '507f1f77bcf86cd799439012';
  const wsPersonal = '507f1f77bcf86cd799439011';
  const wsInvited = '507f1f77bcf86cd799439013';
  const clientDraftId = 'client-draft-1';

  function buildController(options?: {
    activeWorkspaceId?: string | null;
    isMember?: boolean;
    isAdmin?: boolean;
    listBots?: Record<string, unknown>[];
  }) {
    const botsService = {
      findForCustomerWorkspaceList: jest.fn().mockResolvedValue(options?.listBots ?? []),
      getListStatsForBots: jest.fn().mockResolvedValue(new Map()),
      createDraft: jest.fn().mockResolvedValue({ botId: 'bot1', slug: 'slug1' }),
    };

    const workspacesService = {
      resolveActiveWorkspaceForUser: jest
        .fn()
        .mockResolvedValue(options?.activeWorkspaceId === undefined ? wsInvited : options.activeWorkspaceId),
      isUserMemberOfWorkspace: jest.fn().mockResolvedValue(options?.isMember !== false),
      getUserWorkspaceMemberRole: jest.fn().mockResolvedValue('admin'),
      getWorkspaceDisplayName: jest.fn().mockResolvedValue('Invited Workspace'),
      assertWorkspaceAdmin:
        options?.isAdmin === false
          ? jest.fn().mockRejectedValue(
              new ForbiddenException({
                error: 'Workspace admin access required.',
                errorCode: 'workspace_access_denied',
              }),
            )
          : jest.fn().mockResolvedValue(undefined),
      ensurePersonalWorkspaceForUser: jest.fn().mockResolvedValue(new Types.ObjectId(wsPersonal)),
      filterWorkspaceBotsForUser: jest.fn(async (_uid, _ws, bots) => bots),
    };

    const botOnboardingService = { onboardNewBot: jest.fn().mockResolvedValue(undefined) };

    const controller = new CustomerBotsController(
      botsService as never,
      {} as never,
      botOnboardingService as never,
      {} as never,
      workspacesService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const req = { user: { _id: userId, role: 'customer' } } as never;

    return { controller, botsService, workspacesService, botOnboardingService, req };
  }

  describe('GET listBots', () => {
    it('returns only active workspace bots by default', async () => {
      const botInvited = {
        _id: new Types.ObjectId(),
        workspaceId: new Types.ObjectId(wsInvited),
        name: 'Invited bot',
        status: 'published',
      };
      const { controller, botsService, workspacesService, req } = buildController({
        activeWorkspaceId: wsInvited,
        listBots: [botInvited],
      });

      const result = await controller.listBots(req, undefined, undefined);

      expect(workspacesService.resolveActiveWorkspaceForUser).toHaveBeenCalledWith(userId);
      expect(botsService.findForCustomerWorkspaceList).toHaveBeenCalledWith('all', wsInvited);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        _id: String(botInvited._id),
        workspaceId: wsInvited,
        workspaceName: 'Invited Workspace',
      });
    });

    it('filters by explicit workspaceId query when user is a member', async () => {
      const { controller, botsService, workspacesService, req } = buildController();

      await controller.listBots(req, 'published', wsPersonal);

      expect(workspacesService.isUserMemberOfWorkspace).toHaveBeenCalledWith(userId, wsPersonal);
      expect(workspacesService.resolveActiveWorkspaceForUser).not.toHaveBeenCalled();
      expect(botsService.findForCustomerWorkspaceList).toHaveBeenCalledWith('published', wsPersonal);
    });

    it('rejects non-member workspaceId query with 403', async () => {
      const { controller, req } = buildController({ isMember: false });

      await expect(controller.listBots(req, undefined, wsPersonal)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { errorCode: 'workspace_access_denied' },
      });
    });

    it('returns empty list when user has no active workspace', async () => {
      const { controller, botsService, req } = buildController({ activeWorkspaceId: null });

      const result = await controller.listBots(req);

      expect(result).toEqual([]);
      expect(botsService.findForCustomerWorkspaceList).not.toHaveBeenCalled();
    });
  });

  describe('POST createDraft', () => {
    it('creates draft in active workspace for admin', async () => {
      const { controller, botsService, workspacesService, req } = buildController({ activeWorkspaceId: wsInvited });

      await controller.createDraft({ clientDraftId }, req);

      expect(workspacesService.assertWorkspaceAdmin).toHaveBeenCalledWith(userId, wsInvited);
      expect(botsService.createDraft).toHaveBeenCalledWith(clientDraftId, userId, {
        enforceWorkspaceBotLimit: true,
        applyWorkspaceEntitlements: true,
        workspaceId: wsInvited,
      });
    });

    it('creates draft in explicit workspaceId when provided and user is member admin', async () => {
      const { controller, botsService, workspacesService, req } = buildController();

      await controller.createDraft({ clientDraftId, workspaceId: wsPersonal }, req);

      expect(workspacesService.isUserMemberOfWorkspace).toHaveBeenCalledWith(userId, wsPersonal);
      expect(workspacesService.assertWorkspaceAdmin).toHaveBeenCalledWith(userId, wsPersonal);
      expect(botsService.createDraft).toHaveBeenCalledWith(
        clientDraftId,
        userId,
        expect.objectContaining({ workspaceId: wsPersonal }),
      );
    });

    it('rejects non-member explicit workspaceId', async () => {
      const { controller, req } = buildController({ isMember: false });

      await expect(controller.createDraft({ clientDraftId, workspaceId: wsPersonal }, req)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { errorCode: 'workspace_access_denied' },
      });
    });

    it('blocks member role from creating draft', async () => {
      const { controller, req } = buildController({ isAdmin: false });

      await expect(controller.createDraft({ clientDraftId }, req)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('bootstraps personal workspace when user has no active workspace', async () => {
      const { controller, botsService, workspacesService, req } = buildController({ activeWorkspaceId: null });

      await controller.createDraft({ clientDraftId }, req);

      expect(workspacesService.ensurePersonalWorkspaceForUser).toHaveBeenCalledWith(userId);
      expect(botsService.createDraft).toHaveBeenCalledWith(
        clientDraftId,
        userId,
        expect.objectContaining({ workspaceId: wsPersonal }),
      );
    });
  });
});
