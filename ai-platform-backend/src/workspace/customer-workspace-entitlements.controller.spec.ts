import { ForbiddenException } from '@nestjs/common';
import { CustomerWorkspaceEntitlementsController } from './customer-workspace-entitlements.controller';

describe('CustomerWorkspaceEntitlementsController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';

  function buildController(overrides?: { isMember?: boolean }) {
    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue({ planKey: 'free' }),
    };
    const aiCreditsUsageService = {
      getWorkspaceAiCreditsUsage: jest.fn().mockResolvedValue({
        workspaceId,
        monthlyAiCredits: 50,
        monthlyCreditsUsed: 0,
      }),
    };
    const workspacesService = {
      isUserMemberOfWorkspace: jest.fn().mockResolvedValue(overrides?.isMember ?? true),
    };

    const controller = new CustomerWorkspaceEntitlementsController(
      entitlementsService as never,
      aiCreditsUsageService as never,
      workspacesService as never,
    );

    return { controller, entitlementsService, aiCreditsUsageService, workspacesService };
  }

  it('blocks non-members from ai-credits usage endpoint', async () => {
    const { controller } = buildController({ isMember: false });
    const req = { user: { _id: userId } } as never;

    await expect(controller.getAiCreditsUsage(req, workspaceId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns usage summary for workspace members', async () => {
    const { controller, aiCreditsUsageService } = buildController();
    const req = { user: { _id: userId } } as never;

    const result = await controller.getAiCreditsUsage(req, workspaceId);

    expect(aiCreditsUsageService.getWorkspaceAiCreditsUsage).toHaveBeenCalledWith(workspaceId);
    expect(result).toMatchObject({ workspaceId, monthlyAiCredits: 50 });
  });
});
