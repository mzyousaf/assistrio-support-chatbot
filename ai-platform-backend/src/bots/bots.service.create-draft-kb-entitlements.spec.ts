import { Types } from 'mongoose';
import { megabytesToBytes } from '../entitlements/plan-catalog';
import { BotsService } from './bots.service';
import type { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';
import type { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import type { WorkspaceEntitlements } from '../entitlements/workspace-entitlements.types';

const MB = 1024 * 1024;

function freeEntitlements() {
  return {
    workspaceId: '507f1f77bcf86cd799439011',
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
}

function starterEntitlements() {
  return {
    ...freeEntitlements(),
    planKey: 'starter' as const,
    planName: 'Starter',
    kbStorageMbPerBot: 15,
    kbStorageBytesPerBot: megabytesToBytes(15),
  };
}

function proEntitlements() {
  return {
    ...freeEntitlements(),
    planKey: 'pro' as const,
    planName: 'Pro',
    kbStorageMbPerBot: 30,
    kbStorageBytesPerBot: megabytesToBytes(30),
  };
}

describe('BotsService.createDraft workspace KB entitlements', () => {
  const workspaceId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const userId = '507f1f77bcf86cd799439012';
  const clientDraftId = 'draft-client-kb';

  function buildService(overrides: {
    existingDraft?: { _id: Types.ObjectId; slug: string; botConfig?: unknown } | null;
    entitlements?: WorkspaceEntitlements;
  }) {
    const findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(overrides.existingDraft ?? null),
      }),
    });
    const botModel = { findOne, create: jest.fn() } as never;

    const workspacesService = {
      ensurePersonalWorkspaceForUser: jest.fn().mockResolvedValue(workspaceId),
      applyDefaultBotAccessGrantsOnBotCreate: jest.fn().mockResolvedValue(undefined),
    } as never;

    const workspaceBotLimitService = {
      assertCanAddBotToWorkspace: jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceBotLimitService;

    const workspaceEntitlementsService = {
      resolveForWorkspace: jest
        .fn()
        .mockResolvedValue(overrides.entitlements ?? freeEntitlements()),
    } as unknown as WorkspaceEntitlementsService;

    const svc = new BotsService(
      {} as never,
      botModel,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      workspacesService,
      workspaceBotLimitService,
      workspaceEntitlementsService,
      {} as never,
    );

    const createSpy = jest
      .spyOn(svc, 'create')
      .mockResolvedValue({ _id: new Types.ObjectId(), slug: 'new-bot' } as never);
    jest.spyOn(svc, 'generateUniqueSlug').mockResolvedValue('new-bot');

    return { svc, createSpy, workspaceEntitlementsService };
  }

  it('Free workspace new customer draft gets 5 MB KB limit', async () => {
    const { svc, createSpy } = buildService({ entitlements: freeEntitlements() });

    await svc.createDraft(clientDraftId, userId, { applyWorkspaceEntitlements: true });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        botConfig: expect.objectContaining({
          knowledgeSize: expect.objectContaining({
            type: 'default',
            maxBytes: 5 * MB,
            baseMaxBytes: 5 * MB,
            note: 'Free plan',
          }),
        }),
      }),
    );
  });

  it('Starter workspace new customer draft gets 15 MB KB limit', async () => {
    const { svc, createSpy } = buildService({ entitlements: starterEntitlements() });

    await svc.createDraft(clientDraftId, userId, { applyWorkspaceEntitlements: true });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        botConfig: expect.objectContaining({
          knowledgeSize: expect.objectContaining({ maxBytes: 15 * MB }),
        }),
      }),
    );
  });

  it('Pro workspace new customer draft gets 30 MB KB limit', async () => {
    const { svc, createSpy } = buildService({ entitlements: proEntitlements() });

    await svc.createDraft(clientDraftId, userId, { applyWorkspaceEntitlements: true });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        botConfig: expect.objectContaining({
          knowledgeSize: expect.objectContaining({ maxBytes: 30 * MB }),
        }),
      }),
    );
  });

  it('max KB cap is respected and never above 40 MB', async () => {
    const { svc, createSpy } = buildService({
      entitlements: {
        ...freeEntitlements(),
        kbStorageBytesPerBot: megabytesToBytes(50),
        maxKbStorageBytesPerBot: megabytesToBytes(40),
      },
    });

    await svc.createDraft(clientDraftId, userId, { applyWorkspaceEntitlements: true });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        botConfig: expect.objectContaining({
          knowledgeSize: expect.objectContaining({ maxBytes: 40 * MB }),
        }),
      }),
    );
  });

  it('resuming existing draft does not overwrite KB config', async () => {
    const existing = {
      _id: new Types.ObjectId(),
      slug: 'existing-slug',
      botConfig: { knowledgeSize: { maxBytes: 50 * MB } },
    };
    const { svc, createSpy, workspaceEntitlementsService } = buildService({ existingDraft: existing });

    const result = await svc.createDraft(clientDraftId, userId, { applyWorkspaceEntitlements: true });

    expect(result).toEqual({ botId: String(existing._id), slug: 'existing-slug' });
    expect(createSpy).not.toHaveBeenCalled();
    expect(workspaceEntitlementsService.resolveForWorkspace).not.toHaveBeenCalled();
  });

  it('admin path without applyWorkspaceEntitlements keeps default create payload', async () => {
    const { svc, createSpy, workspaceEntitlementsService } = buildService({});

    await svc.createDraft(clientDraftId, userId);

    expect(createSpy).toHaveBeenCalledWith(expect.not.objectContaining({ botConfig: expect.anything() }));
    expect(workspaceEntitlementsService.resolveForWorkspace).not.toHaveBeenCalled();
  });

  it('missing subscription falls back to Free via entitlements resolver', async () => {
    const { svc, createSpy, workspaceEntitlementsService } = buildService({ entitlements: freeEntitlements() });

    await svc.createDraft(clientDraftId, userId, { applyWorkspaceEntitlements: true });

    expect(workspaceEntitlementsService.resolveForWorkspace).toHaveBeenCalledWith(String(workspaceId));
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        botConfig: expect.objectContaining({
          knowledgeSize: expect.objectContaining({ maxBytes: 5 * MB }),
        }),
      }),
    );
  });
});
