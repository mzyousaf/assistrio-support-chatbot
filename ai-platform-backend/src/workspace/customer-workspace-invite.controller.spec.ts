import { ForbiddenException } from '@nestjs/common';
import { CustomerWorkspaceInviteController } from './customer-workspace-invite.controller';

describe('CustomerWorkspaceInviteController', () => {
  const token = 'invite-token';
  const userId = '507f1f77bcf86cd799439012';

  function buildController() {
    const inviteService = {
      previewInviteByToken: jest.fn().mockResolvedValue({
        workspaceName: 'Team Workspace',
        invitedEmail: 'guest@example.com',
        role: 'member',
        expiresAt: new Date(),
        inviterEmail: 'owner@example.com',
        inviterName: 'Owner User',
      }),
      acceptInviteForUser: jest.fn().mockResolvedValue({ workspaceId: '507f1f77bcf86cd799439011' }),
    };

    const workspacesService = {
      ensurePersonalWorkspaceForUser: jest.fn().mockResolvedValue(undefined),
      resolveActiveWorkspaceForUser: jest.fn().mockResolvedValue('507f1f77bcf86cd799439011'),
      getWorkspacesSummaryForUser: jest.fn().mockResolvedValue([
        {
          id: '507f1f77bcf86cd799439011',
          name: 'Team Workspace',
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

    const controller = new CustomerWorkspaceInviteController(
      inviteService as never,
      workspacesService as never,
      entitlementsService as never,
    );

    return { controller, inviteService };
  }

  it('preview does not require auth', async () => {
    const { controller, inviteService } = buildController();
    const result = await controller.preview(token);
    expect(inviteService.previewInviteByToken).toHaveBeenCalledWith(token);
    expect(result.workspaceName).toBe('Team Workspace');
  });

  it('accept returns session payload with activeWorkspaceId and role', async () => {
    const { controller, inviteService } = buildController();
    const req = {
      user: { _id: userId, email: 'guest@example.com', role: 'customer' },
    } as never;

    const result = await controller.accept(req, token);

    expect(inviteService.acceptInviteForUser).toHaveBeenCalledWith(
      token,
      userId,
      'guest@example.com',
    );
    expect(result).toMatchObject({
      activeWorkspaceId: '507f1f77bcf86cd799439011',
      workspaces: [expect.objectContaining({ role: 'member' })],
    });
  });

  it('accept requires customer role', async () => {
    const { controller } = buildController();
    const req = { user: { _id: userId, role: 'superadmin' } } as never;
    await expect(controller.accept(req, token)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
