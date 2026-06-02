import { Types } from 'mongoose';
import { BotsService } from './bots.service';
import { CUSTOMER_LISTING_DRAFT_DEFAULTS } from '../workspace/shared/default-customer-listing-bot.preset';
import type { WorkspaceBotLimitService } from '../entitlements/workspace-bot-limit.service';
import type { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { mockFreeWorkspaceEntitlements } from '../entitlements/test/workspace-entitlements.fixture';

describe('BotsService.createDraft customer_listing source', () => {
  const workspaceId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const userId = '507f1f77bcf86cd799439012';
  const clientDraftId = 'listing-draft-1';

  function buildService() {
    const findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
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
      resolveForWorkspace: jest.fn().mockResolvedValue(mockFreeWorkspaceEntitlements()),
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
      .mockResolvedValue({ _id: new Types.ObjectId(), slug: 'ai-agent' } as never);
    jest.spyOn(svc, 'generateUniqueSlug').mockResolvedValue('ai-agent');

    return { svc, createSpy, workspaceBotLimitService, workspacesService, workspaceEntitlementsService };
  }

  type WorkspacesServiceMock = {
    applyDefaultBotAccessGrantsOnBotCreate: jest.Mock;
  };

  it('creates draft with listing defaults and workspace entitlements', async () => {
    const { svc, createSpy, workspaceBotLimitService, workspacesService } = buildService();

    const result = await svc.createDraft(clientDraftId, userId, {
      enforceWorkspaceBotLimit: true,
      applyWorkspaceEntitlements: true,
      workspaceId: String(workspaceId),
      source: 'customer_listing',
    });

    expect(workspaceBotLimitService.assertCanAddBotToWorkspace).toHaveBeenCalledWith(String(workspaceId));
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: CUSTOMER_LISTING_DRAFT_DEFAULTS.name,
        status: 'draft',
        clientDraftId,
        workspaceId,
        exampleQuestions: [],
        imageUrl: '',
        chatUI: expect.objectContaining({
          primaryColor: '#14B8A6',
          showBranding: false,
          brandingMessage: '',
          showPrivacyText: true,
          privacyText: '',
        }),
        botConfig: expect.objectContaining({
          knowledgeSize: expect.objectContaining({ maxBytes: expect.any(Number) }),
        }),
      }),
    );
    expect((workspacesService as WorkspacesServiceMock).applyDefaultBotAccessGrantsOnBotCreate).toHaveBeenCalledWith({
      workspaceId: String(workspaceId),
      botId: expect.any(String),
      createdByUserId: userId,
    });
    expect(result.slug).toBe('ai-agent');
  });

  it('passes listing overrides into the preset', async () => {
    const { svc, createSpy } = buildService();

    await svc.createDraft(clientDraftId, userId, {
      source: 'customer_listing',
      workspaceId: String(workspaceId),
      listingOverrides: {
        name: 'Custom Agent',
        description: 'Custom description.',
        category: 'Sales',
      },
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Custom Agent',
        description: 'Custom description.',
        categories: ['Sales'],
      }),
    );
  });

  it('uses legacy template defaults when source is omitted', async () => {
    const { svc, createSpy } = buildService();

    await svc.createDraft(clientDraftId, userId);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'AI Support Assistant',
      }),
    );
  });
});
