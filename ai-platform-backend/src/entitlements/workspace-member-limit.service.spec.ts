import { HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  PLAN_LIMIT_WORKSPACE_MEMBERS_CODE,
  PLAN_LIMIT_WORKSPACE_MEMBERS_MESSAGE,
  WorkspaceMemberLimitService,
  workspacePendingInviteCountFilter,
} from './workspace-member-limit.service';
import type { WorkspaceEntitlementsService } from './workspace-entitlements.service';

describe('WorkspaceMemberLimitService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const now = new Date('2026-05-24T12:00:00.000Z');

  const freeEntitlements = {
    workspaceId,
    planKey: 'free' as const,
    planName: 'Free',
    subscriptionStatus: 'free' as const,
    botLimit: 1,
    memberLimit: 3,
    monthlyAiCredits: 50,
    kbStorageMbPerBot: 10,
    kbStorageBytesPerBot: 10 * 1024 * 1024,
    maxKbStorageMbPerBot: 40,
    maxKbStorageBytesPerBot: 40 * 1024 * 1024,
    analyticsHistoryDays: 7,
    canExportReports: false,
    showPoweredByAssistrio: true,
    canRemoveBranding: false,
    activeAddons: [],
    topUpCreditsRemaining: 0,
  };

  function createService(
    memberCount: number,
    pendingInviteCount: number,
    entitlements = freeEntitlements,
  ) {
    const membershipModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(memberCount) }),
    };
    const inviteModel = {
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(pendingInviteCount),
      }),
    };
    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue(entitlements),
    } as unknown as WorkspaceEntitlementsService;

    return {
      service: new WorkspaceMemberLimitService(
        membershipModel as never,
        inviteModel as never,
        entitlementsService,
      ),
      membershipModel,
      inviteModel,
      entitlementsService,
    };
  }

  it('workspacePendingInviteCountFilter counts only pending unexpired invites', () => {
    const wsOid = new Types.ObjectId(workspaceId);
    const filter = workspacePendingInviteCountFilter(wsOid, now);
    expect(filter).toEqual({
      workspaceId: wsOid,
      status: 'pending',
      expiresAt: { $gt: now },
    });
  });

  it('getWorkspaceMemberUsage sums active members and pending unexpired invites', async () => {
    const { service } = createService(2, 1);
    const usage = await service.getWorkspaceMemberUsage(workspaceId, now);
    expect(usage).toMatchObject({
      current: 3,
      limit: 3,
      memberCount: 2,
      pendingInviteCount: 1,
      planKey: 'free',
      planName: 'Free',
    });
  });

  it('assertCanInviteMember allows when under limit', async () => {
    const { service } = createService(1, 1);
    await expect(service.assertCanInviteMember(workspaceId, { now })).resolves.toBeUndefined();
  });

  it('assertCanInviteMember throws plan_limit_workspace_members at limit', async () => {
    const { service } = createService(2, 1);

    await expect(service.assertCanInviteMember(workspaceId, { now })).rejects.toMatchObject({
      response: {
        message: PLAN_LIMIT_WORKSPACE_MEMBERS_MESSAGE,
        errorCode: PLAN_LIMIT_WORKSPACE_MEMBERS_CODE,
        usage: {
          current: 3,
          limit: 3,
          planKey: 'free',
          planName: 'Free',
        },
      },
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('expired/cancelled/accepted invites are excluded via pending filter (not counted)', async () => {
    const { service, inviteModel } = createService(3, 0);
    await expect(service.assertCanInviteMember(workspaceId, { now })).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(inviteModel.countDocuments).toHaveBeenCalledWith(
      workspacePendingInviteCountFilter(new Types.ObjectId(workspaceId), now),
    );
  });

  it('counts only memberships for memberCount query', async () => {
    const { service, membershipModel } = createService(1, 0);
    await service.getWorkspaceMemberUsage(workspaceId, now);
    expect(membershipModel.countDocuments).toHaveBeenCalledWith({
      workspaceId: new Types.ObjectId(workspaceId),
    });
  });
});
