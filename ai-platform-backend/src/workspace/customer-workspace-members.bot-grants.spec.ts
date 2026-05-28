import { ForbiddenException } from '@nestjs/common';
import { CustomerWorkspaceMembersController } from './customer-workspace-members.controller';
import { WORKSPACE_OWNER_PROTECTED_CODE } from '../models/workspace-invite.constants';

describe('CustomerWorkspaceMembersController bot grants', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const ownerUserId = '507f1f77bcf86cd799439012';
  const memberUserId = '507f1f77bcf86cd799439013';
  const inviteId = '507f1f77bcf86cd799439014';

  const ownerReq = {
    user: { _id: ownerUserId, email: 'owner@example.com', role: 'customer' },
  } as never;

  const adminReq = {
    user: { _id: '507f1f77bcf86cd799439015', email: 'admin@example.com', role: 'customer' },
  } as never;

  function buildController() {
    const workspacesService = {
      assertWorkspaceAdmin: jest.fn().mockResolvedValue(undefined),
      assertWorkspaceOwner: jest.fn().mockResolvedValue(undefined),
      listWorkspaceMembers: jest.fn(),
      summarizeMemberBotAccess: jest.fn(),
      getMemberBotGrants: jest.fn().mockResolvedValue({
        grants: [{ botId: 'bot1', botName: 'Agent 1', canView: true, canPreview: false }],
        botAccessSummary: { viewable: 1, previewable: 0 },
      }),
      updateMemberBotGrants: jest.fn().mockResolvedValue({
        grants: [{ botId: 'bot1', botName: 'Agent 1', canView: true, canPreview: true }],
        botAccessSummary: { viewable: 1, previewable: 1 },
      }),
      getInviteBotGrants: jest.fn().mockResolvedValue({
        grants: [],
        botAccessSummary: { viewable: 0, previewable: 0 },
      }),
      updateInviteBotGrants: jest.fn().mockResolvedValue({
        grants: [{ botId: 'bot1', botName: 'Agent 1', canView: true, canPreview: false }],
        botAccessSummary: { viewable: 1, previewable: 0 },
      }),
    };

    const controller = new CustomerWorkspaceMembersController(
      workspacesService as never,
      { listInvitesForWorkspace: jest.fn() } as never,
      { sendWorkspaceInviteEmail: jest.fn() } as never,
      { shouldExposeInviteUrl: jest.fn(), assertInviteEmailDeliveryResult: jest.fn() } as never,
      { get: jest.fn() } as never,
    );

    return { controller, workspacesService };
  }

  it('owner can get active member bot grants', async () => {
    const { controller, workspacesService } = buildController();
    const result = await controller.getMemberBotGrants(ownerReq, workspaceId, memberUserId);
    expect(workspacesService.assertWorkspaceOwner).toHaveBeenCalledWith(ownerUserId, workspaceId);
    expect(result.botAccessSummary.viewable).toBe(1);
  });

  it('owner can patch active member bot grants', async () => {
    const { controller, workspacesService } = buildController();
    const result = await controller.patchMemberBotGrants(ownerReq, workspaceId, memberUserId, {
      grants: [{ botId: 'bot1', canView: true, canPreview: true }],
    });
    expect(workspacesService.updateMemberBotGrants).toHaveBeenCalled();
    expect(result.botAccessSummary.previewable).toBe(1);
  });

  it('owner can patch pending invite bot grants', async () => {
    const { controller, workspacesService } = buildController();
    await controller.patchInviteBotGrants(ownerReq, workspaceId, inviteId, {
      grants: [{ botId: 'bot1', canView: true, canPreview: false }],
    });
    expect(workspacesService.updateInviteBotGrants).toHaveBeenCalledWith(
      expect.objectContaining({ inviteId, actingUserId: ownerUserId }),
    );
  });

  it('admin cannot patch member bot grants when owner assertion fails', async () => {
    const { controller, workspacesService } = buildController();
    workspacesService.updateMemberBotGrants.mockRejectedValue(
      new ForbiddenException({ errorCode: 'workspace_owner_required' }),
    );
    await expect(
      controller.patchMemberBotGrants(adminReq, workspaceId, memberUserId, { grants: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateMemberBotGrants blocks owner row at service layer', async () => {
    const { controller, workspacesService } = buildController();
    workspacesService.updateMemberBotGrants.mockRejectedValue(
      new ForbiddenException({ errorCode: WORKSPACE_OWNER_PROTECTED_CODE }),
    );
    await expect(
      controller.patchMemberBotGrants(ownerReq, workspaceId, ownerUserId, { grants: [] }),
    ).rejects.toMatchObject({ response: { errorCode: WORKSPACE_OWNER_PROTECTED_CODE } });
  });
});
