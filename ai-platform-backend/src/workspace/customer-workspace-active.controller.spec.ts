import { ForbiddenException } from '@nestjs/common';
import { CustomerWorkspaceActiveController } from './customer-workspace-active.controller';

describe('CustomerWorkspaceActiveController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';

  function buildController(options?: { activateError?: Error }) {
    const workspacesService = {
      activateWorkspaceForUser: options?.activateError
        ? jest.fn().mockRejectedValue(options.activateError)
        : jest.fn().mockResolvedValue(undefined),
      ensurePersonalWorkspaceForUser: jest.fn().mockResolvedValue(undefined),
      resolveActiveWorkspaceForUser: jest.fn().mockResolvedValue(workspaceId),
      getWorkspacesSummaryForUser: jest.fn().mockResolvedValue([
        {
          id: workspaceId,
          name: 'Team',
          role: 'member',
          onboardingStatus: 'completed',
          onboardingCurrentStep: 'go-live',
          onboardingCreatedBotId: null,
        },
      ]),
    };
    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue({
        planKey: 'free',
        planName: 'Free',
        subscriptionStatus: 'free',
        botLimit: 1,
        memberLimit: 3,
        monthlyAiCredits: 50,
        kbStorageMbPerBot: 10,
        analyticsHistoryDays: 7,
        canExportReports: false,
        showPoweredByAssistrio: true,
      }),
    };

    const controller = new CustomerWorkspaceActiveController(
      workspacesService as never,
      entitlementsService as never,
    );

    return { controller, workspacesService };
  }

  it('activate sets active workspace and returns updated session payload', async () => {
    const { controller, workspacesService } = buildController();
    const req = {
      user: { _id: userId, email: 'user@example.com', role: 'customer' },
    } as never;

    const result = await controller.activate(req, workspaceId);

    expect(workspacesService.activateWorkspaceForUser).toHaveBeenCalledWith(userId, workspaceId);
    expect(result).toMatchObject({
      activeWorkspaceId: workspaceId,
      workspaces: [expect.objectContaining({ id: workspaceId, role: 'member' })],
    });
  });

  it('activate rejects non-members with 403', async () => {
    const { controller } = buildController({
      activateError: new ForbiddenException({ error: 'Workspace access denied.' }),
    });
    const req = { user: { _id: userId, role: 'customer' } } as never;

    await expect(controller.activate(req, workspaceId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('activate requires customer role', async () => {
    const { controller } = buildController();
    const req = { user: { _id: userId, role: 'superadmin' } } as never;

    await expect(controller.activate(req, workspaceId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
