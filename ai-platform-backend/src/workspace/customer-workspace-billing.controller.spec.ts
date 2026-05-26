import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CustomerWorkspaceBillingController } from './customer-workspace-billing.controller';

describe('CustomerWorkspaceBillingController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';

  function buildController(overrides?: { isMember?: boolean }) {
    const billingSummaryService = {
      getSummary: jest.fn().mockResolvedValue({ workspaceId, plan: { key: 'free' } }),
    };
    const workspacesService = {
      isUserMemberOfWorkspace: jest.fn().mockResolvedValue(overrides?.isMember ?? true),
    };

    const controller = new CustomerWorkspaceBillingController(
      billingSummaryService as never,
      workspacesService as never,
    );

    return { controller, billingSummaryService, workspacesService };
  }

  it('blocks non-members from billing summary endpoint', async () => {
    const { controller } = buildController({ isMember: false });
    const req = { user: { _id: userId } } as never;

    await expect(controller.getBillingSummary(req, workspaceId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns billing summary for workspace members', async () => {
    const { controller, billingSummaryService } = buildController();
    const req = { user: { _id: userId } } as never;

    const result = await controller.getBillingSummary(req, workspaceId);

    expect(billingSummaryService.getSummary).toHaveBeenCalledWith(workspaceId);
    expect(result).toMatchObject({ workspaceId, plan: { key: 'free' } });
  });
});
