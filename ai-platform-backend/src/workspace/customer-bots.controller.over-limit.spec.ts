import { HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { CustomerBotsController } from './customer-bots.controller';
import {
  WORKSPACE_BOT_LIMIT_EXCEEDED_CODE,
  WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE,
} from '../entitlements/workspace-bot-limit.service';

describe('CustomerBotsController over-limit locking', () => {
  const userId = '507f1f77bcf86cd799439012';
  const workspaceId = '507f1f77bcf86cd799439011';
  const botOldId = '507f1f77bcf86cd799439020';
  const botNewId = '507f1f77bcf86cd799439021';

  function buildController(options?: {
    memberRole?: string | null;
    lockedIds?: Set<string>;
    assertLocked?: jest.Mock;
  }) {
    const botsService = {
      findForCustomerWorkspaceList: jest.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(botOldId),
          workspaceId: new Types.ObjectId(workspaceId),
          name: 'Oldest',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
        {
          _id: new Types.ObjectId(botNewId),
          workspaceId: new Types.ObjectId(workspaceId),
          name: 'Newest',
          createdAt: new Date('2024-02-01T00:00:00.000Z'),
        },
      ]),
      getListStatsForBots: jest.fn().mockResolvedValue(new Map()),
      findOne: jest.fn(),
      findOneWorkspaceForAdmin: jest.fn(),
    };

    const workspacesService = {
      resolveActiveWorkspaceForUser: jest.fn().mockResolvedValue(workspaceId),
      getUserWorkspaceMemberRole: jest.fn().mockResolvedValue(options?.memberRole ?? 'admin'),
      getWorkspaceDisplayName: jest.fn().mockResolvedValue('Workspace'),
      filterWorkspaceBotsForUser: jest.fn(async (_uid, _ws, bots) => bots),
      buildBotViewAccessPreviewByBotIds: jest.fn().mockResolvedValue({}),
      assertCanAccessWorkspaceBot: jest.fn().mockResolvedValue(undefined),
    };

    const lockedIds = options?.lockedIds ?? new Set([botNewId]);
    const workspaceBotLimitService = {
      resolveOverLimitLockedBotIdSet: jest.fn().mockResolvedValue(lockedIds),
      enrichBotListWithOverLimitState: jest.fn((bots, ids: Set<string>) =>
        bots.map((bot: { _id: string }) => ({
          ...bot,
          isOverLimitLocked: ids.has(bot._id),
          ...(ids.has(bot._id)
            ? {
                lockedReason: 'workspace_bot_limit_exceeded',
                lockedMessage: WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE,
              }
            : {}),
        })),
      ),
      assertWorkspaceBotWithinEffectiveLimit:
        options?.assertLocked ??
        jest.fn(async (_ws: string, botId: string) => {
          if (lockedIds.has(botId)) {
            throw new HttpException(
              {
                message: WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE,
                errorCode: WORKSPACE_BOT_LIMIT_EXCEEDED_CODE,
              },
              HttpStatus.FORBIDDEN,
            );
          }
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
      workspaceBotLimitService as never,
    );

    return { controller, botsService, workspacesService, workspaceBotLimitService, req: { user: { _id: userId, role: 'customer' } } as never };
  }

  it('marks newer bots as locked for workspace owner list', async () => {
    const { controller, req } = buildController({ memberRole: 'owner' });
    const result = await controller.listBots(req, undefined, undefined);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ _id: botOldId, isOverLimitLocked: false });
    expect(result[1]).toMatchObject({
      _id: botNewId,
      isOverLimitLocked: true,
      lockedReason: 'workspace_bot_limit_exceeded',
    });
  });

  it('shows locked bots to workspace admins', async () => {
    const { controller, req } = buildController({ memberRole: 'admin' });
    const result = await controller.listBots(req, undefined, undefined);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ _id: botNewId, isOverLimitLocked: true });
  });

  it('hides locked bots from workspace members', async () => {
    const { controller, req } = buildController({ memberRole: 'member' });
    const result = await controller.listBots(req, undefined, undefined);
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe(botOldId);
  });

  it('returns 403 when fetching locked bot detail', async () => {
    const { controller, botsService, req } = buildController();
    botsService.findOne.mockResolvedValue({
      _id: new Types.ObjectId(botNewId),
      workspaceId: new Types.ObjectId(workspaceId),
    });
    botsService.findOneWorkspaceForAdmin.mockResolvedValue({
      _id: new Types.ObjectId(botNewId),
      workspaceId: new Types.ObjectId(workspaceId),
      name: 'Newest',
    });

    await expect(controller.getBot(botNewId, req)).rejects.toMatchObject({
      response: {
        message: WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE,
        errorCode: WORKSPACE_BOT_LIMIT_EXCEEDED_CODE,
      },
      status: HttpStatus.FORBIDDEN,
    });
  });
});
