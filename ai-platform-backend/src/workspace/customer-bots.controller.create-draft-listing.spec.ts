import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { CustomerBotsController } from './customer-bots.controller';

describe('CustomerBotsController createDraft listing bootstrap', () => {
  const userId = '507f1f77bcf86cd799439012';
  const wsId = '507f1f77bcf86cd799439011';
  const clientDraftId = 'client-draft-listing';

  function buildController() {
    const botsService = {
      createDraft: jest.fn().mockResolvedValue({ botId: 'bot-listing-1', slug: 'ai-agent' }),
    };
    const workspacesService = {
      resolveActiveWorkspaceForUser: jest.fn().mockResolvedValue(wsId),
      isUserMemberOfWorkspace: jest.fn().mockResolvedValue(true),
      assertWorkspaceAdmin: jest.fn().mockResolvedValue(undefined),
      ensurePersonalWorkspaceForUser: jest.fn(),
    };
    const botOnboardingService = {
      onboardNewBot: jest.fn().mockResolvedValue({ docsQueued: 5 }),
    };

    const controller = new CustomerBotsController(
      botsService as never,
      {} as never,
      botOnboardingService as never,
      {} as never,
      workspacesService as never,
      {} as never,
      {} as never,
      {} as never,
      { resolveOverLimitLockedBotIdSet: jest.fn(), enrichBotListWithOverLimitState: jest.fn() } as never,
    );

    const req = { user: { _id: userId, role: 'customer' } } as never;
    return { controller, botsService, botOnboardingService, workspacesService, req };
  }

  it('does not call BotOnboardingService.onboardNewBot for customer listing create', async () => {
    const { controller, botOnboardingService, req } = buildController();

    const result = await controller.createDraft({ clientDraftId }, req);

    expect(botOnboardingService.onboardNewBot).not.toHaveBeenCalled();
    expect(result).toEqual({ botId: 'bot-listing-1', slug: 'ai-agent' });
  });

  it('passes customer_listing source and listing overrides to BotsService.createDraft', async () => {
    const { controller, botsService, req } = buildController();

    await controller.createDraft(
      {
        clientDraftId,
        workspaceId: wsId,
        name: 'AI Agent',
        description: 'A helpful AI support agent that answers customer questions clearly and professionally.',
        category: 'Support',
        brandColor: '#14B8A6',
      },
      req,
    );

    expect(botsService.createDraft).toHaveBeenCalledWith(clientDraftId, userId, {
      enforceWorkspaceBotLimit: true,
      applyWorkspaceEntitlements: true,
      workspaceId: wsId,
      source: 'customer_listing',
      listingOverrides: {
        name: 'AI Agent',
        description:
          'A helpful AI support agent that answers customer questions clearly and professionally.',
        category: 'Support',
        brandColor: '#14B8A6',
      },
    });
  });

  it('enforces workspace admin before create', async () => {
    const { controller, workspacesService, req } = buildController();
    workspacesService.assertWorkspaceAdmin.mockRejectedValue(
      new ForbiddenException({ errorCode: 'workspace_access_denied' }),
    );

    await expect(controller.createDraft({ clientDraftId }, req)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('propagates bot limit errors from createDraft', async () => {
    const { controller, botsService, req } = buildController();
    botsService.createDraft.mockRejectedValue(
      new HttpException({ errorCode: 'plan_limit_workspace_bots' }, HttpStatus.FORBIDDEN),
    );

    await expect(controller.createDraft({ clientDraftId }, req)).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });
});
