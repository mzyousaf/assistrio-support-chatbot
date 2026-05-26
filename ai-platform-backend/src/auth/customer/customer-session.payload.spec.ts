import { buildCustomerSessionPayload } from './customer-session.payload';
import type { WorkspaceEntitlementsService } from '../../entitlements/workspace-entitlements.service';
import type { WorkspacesService } from '../../workspaces/workspaces.service';
import type { RequestUser } from '../shared/request-user.types';
import { megabytesToBytes } from '../../entitlements/plan-catalog';
import type { WorkspaceEntitlements } from '../../entitlements/workspace-entitlements.types';

describe('buildCustomerSessionPayload', () => {
  const user: RequestUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'user@example.com',
    role: 'customer',
    firstName: 'Ada',
    lastName: 'Lovelace',
    picture: 'https://example.com/avatar.png',
  };

  const freeEntitlements: WorkspaceEntitlements = {
    workspaceId: 'ws1',
    planKey: 'free' as const,
    planName: 'Free',
    subscriptionStatus: 'free' as const,
    botLimit: 1,
    memberLimit: 3,
    monthlyAiCredits: 50,
    kbStorageMbPerBot: 5,
    kbStorageBytesPerBot: megabytesToBytes(5),
    maxKbStorageMbPerBot: 40,
    maxKbStorageBytesPerBot: megabytesToBytes(40),
    analyticsHistoryDays: 7,
    canExportReports: false,
    showPoweredByAssistrio: true,
    canRemoveBranding: false,
    activeAddons: [],
    topUpCreditsRemaining: 0,
  };

  function mockWorkspacesService(overrides: Partial<WorkspacesService> = {}): WorkspacesService {
    return {
      ensurePersonalWorkspaceForUser: jest.fn().mockResolvedValue(undefined),
      resolveActiveWorkspaceForUser: jest.fn().mockResolvedValue('ws1'),
      getWorkspacesSummaryForUser: jest.fn().mockResolvedValue([
        {
          id: 'ws1',
          name: 'Ada workspace',
          role: 'admin',
          onboardingStatus: 'not_started',
          onboardingCurrentStep: 'agent-profile',
          onboardingCreatedBotId: null,
        },
      ]),
      ...overrides,
    } as unknown as WorkspacesService;
  }

  function mockEntitlementsService(
    resolver: (workspaceId: string) => Promise<WorkspaceEntitlements> = async () => freeEntitlements,
  ): WorkspaceEntitlementsService {
    return {
      resolveForWorkspace: jest.fn(resolver),
    } as unknown as WorkspaceEntitlementsService;
  }

  it('returns session fields with activeWorkspaceId, role, and workspace plan summary', async () => {
    const ws = mockWorkspacesService();
    const entitlements = mockEntitlementsService();
    const payload = await buildCustomerSessionPayload(user, ws, entitlements);

    expect(payload).toEqual({
      id: '507f1f77bcf86cd799439011',
      email: 'user@example.com',
      role: 'customer',
      activeWorkspaceId: 'ws1',
      workspaceIds: ['ws1'],
      workspaces: [
        {
          id: 'ws1',
          name: 'Ada workspace',
          role: 'admin',
          planKey: 'free',
          planName: 'Free',
          subscriptionStatus: 'free',
          botLimit: 1,
          memberLimit: 3,
          monthlyAiCredits: 50,
          kbStorageMbPerBot: 5,
          analyticsHistoryDays: 7,
          canExportReports: false,
          showPoweredByAssistrio: true,
          onboardingStatus: 'not_started',
          onboardingCurrentStep: 'agent-profile',
          onboardingCreatedBotId: null,
        },
      ],
      firstName: 'Ada',
      lastName: 'Lovelace',
      picture: 'https://example.com/avatar.png',
    });
    expect(payload).not.toHaveProperty('needsOnboarding');
    expect(Object.keys(payload).sort()).toEqual(
      [
        'activeWorkspaceId',
        'email',
        'firstName',
        'id',
        'lastName',
        'picture',
        'role',
        'workspaceIds',
        'workspaces',
      ].sort(),
    );
  });

  it('resolves missing subscription as Free via entitlements service', async () => {
    const entitlements = mockEntitlementsService(async (workspaceId) => ({
      ...freeEntitlements,
      workspaceId,
    }));
    const payload = await buildCustomerSessionPayload(user, mockWorkspacesService(), entitlements);

    expect(payload.workspaces[0]?.planKey).toBe('free');
    expect(payload.workspaces[0]?.canExportReports).toBe(false);
    expect(entitlements.resolveForWorkspace).toHaveBeenCalledWith('ws1');
  });

  it('includes Starter export entitlement when resolver returns starter plan', async () => {
    const entitlements = mockEntitlementsService(async () => ({
      ...freeEntitlements,
      planKey: 'starter' as const,
      planName: 'Starter',
      subscriptionStatus: 'active' as const,
      monthlyAiCredits: 500,
      kbStorageMbPerBot: 15,
      analyticsHistoryDays: null,
      canExportReports: true,
    }));

    const payload = await buildCustomerSessionPayload(user, mockWorkspacesService(), entitlements);

    expect(payload.workspaces[0]).toMatchObject({
      planKey: 'starter',
      planName: 'Starter',
      subscriptionStatus: 'active',
      canExportReports: true,
      analyticsHistoryDays: null,
    });
  });

  it('ensures personal workspace and resolves active workspace before listing workspaces', async () => {
    const ensure = jest.fn().mockResolvedValue(undefined);
    const resolveActive = jest.fn().mockResolvedValue(null);
    const getSummary = jest.fn().mockResolvedValue([]);
    const ws = mockWorkspacesService({
      ensurePersonalWorkspaceForUser: ensure,
      resolveActiveWorkspaceForUser: resolveActive,
      getWorkspacesSummaryForUser: getSummary,
    });

    await buildCustomerSessionPayload(user, ws, mockEntitlementsService());

    expect(ensure).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(resolveActive).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(getSummary).toHaveBeenCalledWith('507f1f77bcf86cd799439011', null);
  });

  it('passes activeWorkspaceId into workspace summary ordering', async () => {
    const resolveActive = jest.fn().mockResolvedValue('ws2');
    const getSummary = jest.fn().mockResolvedValue([]);
    const ws = mockWorkspacesService({
      resolveActiveWorkspaceForUser: resolveActive,
      getWorkspacesSummaryForUser: getSummary,
    });

    await buildCustomerSessionPayload(user, ws, mockEntitlementsService());

    expect(getSummary).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'ws2');
  });

  it('omits optional profile fields when absent', async () => {
    const minimal: RequestUser = {
      _id: 'abc',
      email: 'min@example.com',
      role: 'customer',
    };
    const payload = await buildCustomerSessionPayload(
      minimal,
      mockWorkspacesService(),
      mockEntitlementsService(),
    );

    expect(payload.firstName).toBeUndefined();
    expect(payload.lastName).toBeUndefined();
    expect(payload.picture).toBeUndefined();
  });
});
