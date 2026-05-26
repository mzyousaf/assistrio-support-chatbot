import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { AdminWorkspaceBillingController } from './admin-workspace-billing.controller';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';

describe('AdminWorkspaceBillingController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function buildController() {
    const billingSummaryService = {
      getAdminSummary: jest.fn().mockResolvedValue({
        workspaceId,
        plan: { key: 'free', name: 'Free', status: 'free' },
        entitlements: {
          botLimit: 1,
          memberLimit: 3,
          monthlyAiCredits: 50,
          canExportReports: false,
          canRemoveBranding: false,
        },
        usage: {
          bots: { current: 0, limit: 1 },
          members: { current: 1, pendingInvites: 0, used: 1, limit: 3 },
          aiCredits: { monthlyCreditsUsed: 0, monthlyCredits: 50 },
        },
        admin: {
          workspaceName: 'Acme',
          workspaceOwnerEmail: 'owner@example.com',
          subscriptionId: null,
          usageLedgerCount: 0,
        },
      }),
    };

    const controller = new AdminWorkspaceBillingController(billingSummaryService as never);
    return { controller, billingSummaryService };
  }

  it('returns admin billing summary for superadmin route', async () => {
    const { controller, billingSummaryService } = buildController();

    const result = await controller.getBillingSummary(workspaceId);

    expect(billingSummaryService.getAdminSummary).toHaveBeenCalledWith(workspaceId);
    expect(result).toMatchObject({
      workspaceId,
      plan: { key: 'free', name: 'Free' },
      entitlements: expect.objectContaining({ monthlyAiCredits: 50 }),
      admin: expect.objectContaining({ workspaceName: 'Acme' }),
    });
  });

  it('blocks non-superadmin via SuperAdminGuard', () => {
    const guard = new SuperAdminGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'operator' } }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
