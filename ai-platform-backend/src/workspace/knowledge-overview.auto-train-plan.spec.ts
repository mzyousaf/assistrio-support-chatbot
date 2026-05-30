import { HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { KnowledgeOverviewService } from './knowledge-overview.service';
import type { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';

describe('KnowledgeOverviewService auto-train plan gate', () => {
  const botId = '507f1f77bcf86cd799439020';
  const workspaceId = '507f1f77bcf86cd799439011';

  function createService(options: { autoTrainAllowed?: boolean }) {
    const botModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: new Types.ObjectId(botId),
            workspaceId: new Types.ObjectId(workspaceId),
          }),
        }),
      }),
      updateOne: jest.fn(),
    };

    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue({
        autoTrainAllowed: options.autoTrainAllowed ?? false,
      }),
    } as unknown as WorkspaceEntitlementsService;

    const service = new KnowledgeOverviewService(
      botModel as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      entitlementsService,
    );

    service.getOverviewForBot = jest.fn().mockResolvedValue({ ok: true });

    return { service, botModel, entitlementsService };
  }

  it('blocks enabling auto-train on free trial', async () => {
    const { service } = createService({ autoTrainAllowed: false });

    await expect(
      service.patchTrainingSettings(botId, { autoTrainEnabled: true }),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        errorCode: 'plan_limit_auto_train',
        message: 'Auto-train is available on paid plans.',
      },
    });
  });

  it('allows paid plans to enable auto-train', async () => {
    const { service, botModel } = createService({ autoTrainAllowed: true });
    botModel.updateOne.mockResolvedValue({ matchedCount: 1 });

    await expect(
      service.patchTrainingSettings(botId, { autoTrainEnabled: true }),
    ).resolves.toEqual({ ok: true });
  });
});
