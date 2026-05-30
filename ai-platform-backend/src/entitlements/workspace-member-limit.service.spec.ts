import { HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  PLAN_LIMIT_WORKSPACE_MEMBERS_CODE,
  PLAN_LIMIT_WORKSPACE_MEMBERS_MESSAGE,
  PLAN_LIMIT_WORKSPACE_MEMBERS_TRIAL_MESSAGE,
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
    subscriptionStatus: 'trialing' as const,
    botLimit: 1,
    memberLimit: 1,
    monthlyAiCredits: 50,
    kbStorageMbPerBot: 5,
    kbStorageBytesPerBot: 5 * 1024 * 1024,
    maxKbStorageMbPerBot: 40,
    maxKbStorageBytesPerBot: 40 * 1024 * 1024,
    analyticsHistoryDays: 7,
    canExportReports: false,
    showPoweredByAssistrio: true,
    isTrialPlan: true,
    trialDays: 7,
    trialStartedAt: null,
    trialEndsAt: null,
    isTrialExpired: false,
    creditsRenewMonthly: false,
    autoTrainAllowed: false,
    addonsAllowed: false,
    memberInvitesAllowed: false,
    canRemoveBranding: false,
    activeAddons: [],
    topUpCreditsRemaining: 0,
    kbStorageBonusMbByBotId: {},
  };

  const starterEntitlements = {
    ...freeEntitlements,
    planKey: 'starter' as const,
    planName: 'Starter',
    subscriptionStatus: 'active' as const,
    memberLimit: 5,
    isTrialPlan: false,
    memberInvitesAllowed: true,
    autoTrainAllowed: true,
    addonsAllowed: true,
    creditsRenewMonthly: true,
  };

  function createService(
    memberCount: number,
    pendingInviteCount: number,
    entitlements: typeof freeEntitlements | typeof starterEntitlements = freeEntitlements,
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

  it('blocks free trial invites before seat limit is reached', async () => {
    const { service } = createService(1, 0);

    await expect(service.assertCanInviteMember(workspaceId, { now })).rejects.toMatchObject({
      response: {
        message: PLAN_LIMIT_WORKSPACE_MEMBERS_TRIAL_MESSAGE,
        errorCode: PLAN_LIMIT_WORKSPACE_MEMBERS_CODE,
      },
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('allows starter invites when under the 5-seat limit', async () => {
    const { service } = createService(2, 1, starterEntitlements);
    await expect(service.assertCanInviteMember(workspaceId, { now })).resolves.toBeUndefined();
  });

  it('throws plan_limit_workspace_members at starter limit', async () => {
    const { service } = createService(4, 1, starterEntitlements);

    await expect(service.assertCanInviteMember(workspaceId, { now })).rejects.toMatchObject({
      response: {
        message: PLAN_LIMIT_WORKSPACE_MEMBERS_MESSAGE,
        errorCode: PLAN_LIMIT_WORKSPACE_MEMBERS_CODE,
        usage: {
          current: 5,
          limit: 5,
          planKey: 'starter',
          planName: 'Starter',
        },
      },
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('blocks invites when active members exceed plan limit after downgrade', async () => {
    const { service } = createService(8, 0, starterEntitlements);

    await expect(service.assertCanInviteMember(workspaceId, { now })).rejects.toMatchObject({
      response: {
        message: expect.stringContaining('more members than your current plan allows'),
        errorCode: PLAN_LIMIT_WORKSPACE_MEMBERS_CODE,
      },
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('reports isOverMemberLimit in usage summary', async () => {
    const { service } = createService(8, 0, starterEntitlements);
    const usage = await service.getWorkspaceMemberUsage(workspaceId, now);
    expect(usage.isOverMemberLimit).toBe(true);
    expect(usage.memberCount).toBe(8);
    expect(usage.limit).toBe(5);
  });
});
