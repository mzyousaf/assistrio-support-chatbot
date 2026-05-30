import { HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  PLAN_LIMIT_WORKSPACE_BOTS_CODE,
  PLAN_LIMIT_WORKSPACE_BOTS_MESSAGE,
  WORKSPACE_BOT_LIMIT_EXCEEDED_CODE,
  WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE,
  WorkspaceBotLimitService,
  workspaceCustomerBotCountFilter,
} from './workspace-bot-limit.service';
import type { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import {
  mockFreeWorkspaceEntitlements,
  mockStarterWorkspaceEntitlements,
} from './test/workspace-entitlements.fixture';

describe('WorkspaceBotLimitService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function createService(
    count: number,
    entitlements: Awaited<ReturnType<WorkspaceEntitlementsService['resolveForWorkspace']>>,
    listBots?: Array<{ _id: Types.ObjectId; createdAt: Date }>,
  ) {
    const botModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(count) }),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(
                listBots ??
                  Array.from({ length: count }, (_, i) => ({
                    _id: new Types.ObjectId(`507f1f77bcf86cd79943901${i}`),
                    createdAt: new Date(Date.UTC(2024, 0, i + 1)),
                  })),
              ),
            }),
          }),
        }),
      }),
    };
    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue(entitlements),
    } as unknown as WorkspaceEntitlementsService;

    return {
      service: new WorkspaceBotLimitService(botModel as never, entitlementsService),
      botModel,
      entitlementsService,
    };
  }

  const freeEntitlements = mockFreeWorkspaceEntitlements({ workspaceId });

  it('workspaceCustomerBotCountFilter excludes platform bots and deleted bots', () => {
    const filter = workspaceCustomerBotCountFilter(new Types.ObjectId(workspaceId));
    expect(filter.workspaceId).toEqual(new Types.ObjectId(workspaceId));
    expect(JSON.stringify(filter)).toContain('isPlatformBot');
  });

  it('allows create when workspace is under bot limit', async () => {
    const { service } = createService(0, freeEntitlements);
    await expect(service.assertCanAddBotToWorkspace(workspaceId)).resolves.toBeUndefined();
  });

  it('blocks create when workspace is at bot limit', async () => {
    const { service } = createService(1, freeEntitlements);

    await expect(service.assertCanAddBotToWorkspace(workspaceId)).rejects.toMatchObject({
      response: {
        message: PLAN_LIMIT_WORKSPACE_BOTS_MESSAGE,
        errorCode: PLAN_LIMIT_WORKSPACE_BOTS_CODE,
        usage: {
          current: 1,
          limit: 1,
          planKey: 'free',
          planName: 'Free',
        },
      },
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('falls back to Free entitlements when subscription is missing', async () => {
    const { service, entitlementsService } = createService(1, freeEntitlements);
    await expect(service.assertCanAddBotToWorkspace(workspaceId)).rejects.toBeInstanceOf(HttpException);
    expect(entitlementsService.resolveForWorkspace).toHaveBeenCalledWith(workspaceId);
  });

  it('allows second bot when extra_bot add-on raised limit to 2', async () => {
    const starterWithExtraBot = mockStarterWorkspaceEntitlements({
      workspaceId,
      botLimit: 2,
      activeAddons: ['extra_bot'],
    });
    const { service } = createService(1, starterWithExtraBot);
    await expect(service.assertCanAddBotToWorkspace(workspaceId)).resolves.toBeUndefined();
  });

  it('excludeBotId reduces counted bots for publish defensive check', async () => {
    const { service, botModel } = createService(0, freeEntitlements);
    await service.assertCanAddBotToWorkspace(workspaceId, { excludeBotId: '507f1f77bcf86cd799439012' });
    expect(botModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $ne: new Types.ObjectId('507f1f77bcf86cd799439012') },
      }),
    );
  });

  it('locks second bot when plan limit is 1 and no extra_bot', async () => {
    const botOld = new Types.ObjectId('507f1f77bcf86cd799439010');
    const botNew = new Types.ObjectId('507f1f77bcf86cd799439011');
    const { service } = createService(2, freeEntitlements, [
      { _id: botOld, createdAt: new Date('2024-01-01T00:00:00.000Z') },
      { _id: botNew, createdAt: new Date('2024-02-01T00:00:00.000Z') },
    ]);

    await expect(
      service.assertWorkspaceBotWithinEffectiveLimit(workspaceId, String(botNew)),
    ).rejects.toMatchObject({
      response: {
        message: WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE,
        errorCode: WORKSPACE_BOT_LIMIT_EXCEEDED_CODE,
      },
      status: HttpStatus.FORBIDDEN,
    });
    await expect(
      service.assertWorkspaceBotWithinEffectiveLimit(workspaceId, String(botOld)),
    ).resolves.toBeUndefined();
  });

  it('does not lock second bot when extra_bot raised limit to 2', async () => {
    const starterWithExtraBot = mockStarterWorkspaceEntitlements({
      workspaceId,
      botLimit: 2,
      activeAddons: ['extra_bot'],
    });
    const botOld = new Types.ObjectId('507f1f77bcf86cd799439010');
    const botNew = new Types.ObjectId('507f1f77bcf86cd799439011');
    const { service } = createService(2, starterWithExtraBot, [
      { _id: botOld, createdAt: new Date('2024-01-01T00:00:00.000Z') },
      { _id: botNew, createdAt: new Date('2024-02-01T00:00:00.000Z') },
    ]);

    await expect(
      service.assertWorkspaceBotWithinEffectiveLimit(workspaceId, String(botNew)),
    ).resolves.toBeUndefined();
  });

  it('enriches list items with locked metadata', async () => {
    const { service } = createService(2, freeEntitlements);
    const locked = await service.resolveOverLimitLockedBotIdSet(workspaceId);
    const enriched = service.enrichBotListWithOverLimitState(
      [{ _id: '507f1f77bcf86cd799439010' }, { _id: '507f1f77bcf86cd799439011' }],
      locked,
    );
    expect(enriched[0].isOverLimitLocked).toBe(false);
    expect(enriched[1].isOverLimitLocked).toBe(true);
    expect(enriched[1].lockedReason).toBe('workspace_bot_limit_exceeded');
  });
});
