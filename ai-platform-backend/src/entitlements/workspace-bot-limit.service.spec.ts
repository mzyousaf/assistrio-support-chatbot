import { HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  PLAN_LIMIT_WORKSPACE_BOTS_CODE,
  PLAN_LIMIT_WORKSPACE_BOTS_MESSAGE,
  WorkspaceBotLimitService,
  workspaceCustomerBotCountFilter,
} from './workspace-bot-limit.service';
import type { WorkspaceEntitlementsService } from './workspace-entitlements.service';

describe('WorkspaceBotLimitService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function createService(count: number, entitlements: Awaited<ReturnType<WorkspaceEntitlementsService['resolveForWorkspace']>>) {
    const botModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(count) }),
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

  const freeEntitlements = {
    workspaceId,
    planKey: 'free' as const,
    planName: 'Free',
    subscriptionStatus: 'free' as const,
    botLimit: 1,
    memberLimit: 3,
    monthlyAiCredits: 50,
    kbStorageMbPerBot: 5,
    kbStorageBytesPerBot: 5 * 1024 * 1024,
    maxKbStorageMbPerBot: 40,
    maxKbStorageBytesPerBot: 40 * 1024 * 1024,
    analyticsHistoryDays: 7,
    canExportReports: false,
    showPoweredByAssistrio: true,
    canRemoveBranding: false,
    activeAddons: [],
    topUpCreditsRemaining: 0,
  };

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

  it('excludeBotId reduces counted bots for publish defensive check', async () => {
    const { service, botModel } = createService(0, freeEntitlements);
    await service.assertCanAddBotToWorkspace(workspaceId, { excludeBotId: '507f1f77bcf86cd799439012' });
    expect(botModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $ne: new Types.ObjectId('507f1f77bcf86cd799439012') },
      }),
    );
  });
});
