import { ForbiddenException } from '@nestjs/common';
import { CustomerWorkspaceOnboardingController } from './customer-workspace-onboarding.controller';

describe('CustomerWorkspaceOnboardingController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';

  function buildController(overrides?: { isMember?: boolean }) {
    const workspaceOnboardingService = {
      getOnboardingForWorkspace: jest.fn().mockResolvedValue({
        workspaceId,
        onboardingStatus: 'in_progress',
        onboardingCurrentStep: 'agent-profile',
        onboardingDraftId: '507f1f77bcf86cd799439013',
        onboardingCreatedBotId: null,
        onboardingCompletedAt: null,
        draft: {
          profile: { name: '', shortDescription: '', description: '', brandColor: '', categories: [], avatarSource: '', imageUrl: '', avatarEmoji: '', avatarStorageKey: '' },
          instructions: { description: '', systemPrompt: '', tone: 'friendly', behaviorPreset: 'default', responseLength: 'medium', maxTokens: 160 },
          knowledge: { knowledgeDescription: '', faqs: [] },
          goLive: { allowedOrigins: [] },
          stepsCompleted: [],
          createdAt: null,
          updatedAt: null,
        },
      }),
      patchProfile: jest.fn(),
      patchInstructions: jest.fn(),
      patchKnowledge: jest.fn(),
      patchGoLive: jest.fn(),
      patchProgress: jest.fn(),
      completeOnboarding: jest.fn().mockResolvedValue({
        workspaceId,
        onboardingStatus: 'completed',
        onboardingCurrentStep: 'you-are-live',
        onboardingDraftId: '507f1f77bcf86cd799439013',
        onboardingCreatedBotId: '507f1f77bcf86cd799439014',
        onboardingCompletedAt: '2026-05-21T00:00:00.000Z',
        draft: {
          profile: { name: '', shortDescription: '', description: '', brandColor: '', categories: [], avatarSource: '', imageUrl: '', avatarEmoji: '', avatarStorageKey: '' },
          instructions: { description: '', systemPrompt: '', tone: 'friendly', behaviorPreset: 'default', responseLength: 'medium', maxTokens: 160 },
          knowledge: { knowledgeDescription: '', faqs: [] },
          goLive: { allowedOrigins: [] },
          stepsCompleted: ['you-are-live'],
          createdAt: null,
          updatedAt: null,
        },
      }),
      uploadAvatar: jest.fn().mockResolvedValue({
        workspaceId,
        onboardingStatus: 'in_progress',
        onboardingCurrentStep: 'agent-profile',
        onboardingDraftId: '507f1f77bcf86cd799439013',
        onboardingCreatedBotId: null,
        onboardingCompletedAt: null,
        draft: {
          profile: {
            name: '',
            shortDescription: '',
            description: '',
            categories: [],
            avatarSource: 'upload',
            imageUrl: 'https://cdn.example.com/onboarding-avatar.png',
            avatarEmoji: '',
            avatarStorageKey: 'uploads/onboarding-drafts/x/avatar/y.png',
          },
          instructions: { description: '', systemPrompt: '', tone: 'friendly', behaviorPreset: 'default', responseLength: 'medium', maxTokens: 160 },
          knowledge: { knowledgeDescription: '', faqs: [] },
          goLive: { allowedOrigins: [] },
          stepsCompleted: [],
          createdAt: null,
          updatedAt: null,
        },
      }),
    };

    const workspaceOnboardingKnowledgeStagingService = {
      attachStagedKnowledgeToResponse: jest.fn(async (response: unknown) => ({
        ...(response as object),
        stagedKnowledge: { documents: [], datasheets: [] },
      })),
      uploadDocuments: jest.fn(),
      uploadDatasheet: jest.fn(),
      listStagedKnowledge: jest.fn(async () => ({ documents: [], datasheets: [] })),
      deleteStagedItem: jest.fn(),
    };
    const workspaceOnboardingKnowledgeContentService = {
      listSnippets: jest.fn(),
      createSnippet: jest.fn(),
      updateSnippet: jest.fn(),
      deleteSnippet: jest.fn(),
      listQas: jest.fn(),
      createQa: jest.fn(),
      updateQa: jest.fn(),
      deleteQa: jest.fn(),
      importQas: jest.fn(),
    };
    const workspaceOnboardingGoLiveService = {
      goLive: jest.fn().mockResolvedValue({
        workspaceId,
        onboardingStatus: 'live_pending_install',
        onboardingCurrentStep: 'you-are-live',
        bot: { id: '507f1f77bcf86cd799439014', name: 'Bot', slug: 'bot', status: 'published', accessKey: 'ak', visibility: 'public', allowedOrigins: [] },
      }),
    };
    const workspacesService = {
      isUserMemberOfWorkspace: jest.fn().mockResolvedValue(overrides?.isMember ?? true),
    };

    const workspaceOnboardingDictationService = {};
    const controller = new CustomerWorkspaceOnboardingController(
      workspacesService as never,
      workspaceOnboardingService as never,
      workspaceOnboardingGoLiveService as never,
      workspaceOnboardingKnowledgeStagingService as never,
      workspaceOnboardingKnowledgeContentService as never,
      workspaceOnboardingDictationService as never,
    );

    return { controller, workspaceOnboardingService, workspaceOnboardingGoLiveService, workspacesService };
  }

  it('blocks non-members from onboarding GET', async () => {
    const { controller } = buildController({ isMember: false });
    const req = { user: { _id: userId } } as never;

    await expect(controller.getOnboarding(req, workspaceId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns onboarding state for workspace members', async () => {
    const { controller, workspaceOnboardingService } = buildController();
    const req = { user: { _id: userId } } as never;

    const result = await controller.getOnboarding(req, workspaceId);

    expect(workspaceOnboardingService.getOnboardingForWorkspace).toHaveBeenCalledWith(workspaceId);
    expect(result).toMatchObject({ workspaceId, onboardingStatus: 'in_progress' });
  });

  it('delegates profile patch without touching bot APIs', async () => {
    const { controller, workspaceOnboardingService } = buildController();
    const req = { user: { _id: userId } } as never;
    workspaceOnboardingService.patchProfile.mockResolvedValue({ workspaceId, onboardingStatus: 'in_progress' });

    await controller.patchProfile(req, workspaceId, {
      name: 'Support Bot',
      description: 'Helps customers',
    });

    expect(workspaceOnboardingService.patchProfile).toHaveBeenCalledWith(workspaceId, {
      name: 'Support Bot',
      description: 'Helps customers',
      shortDescription: undefined,
      categories: undefined,
      avatarSource: undefined,
      imageUrl: undefined,
      avatarEmoji: undefined,
      avatarStorageKey: undefined,
    });
  });

  it('blocks non-members from POST go-live', async () => {
    const { controller } = buildController({ isMember: false });
    const req = { user: { _id: userId } } as never;

    await expect(controller.postGoLive(req, workspaceId, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delegates POST go-live to go-live service', async () => {
    const { controller, workspaceOnboardingGoLiveService } = buildController();
    const req = { user: { _id: userId } } as never;

    const result = await controller.postGoLive(req, workspaceId, { origin: 'https://example.com' });

    expect(workspaceOnboardingGoLiveService.goLive).toHaveBeenCalledWith(workspaceId, userId, {
      origin: 'https://example.com',
      label: undefined,
      idempotencyKey: undefined,
    });
    expect(result.onboardingStatus).toBe('live_pending_install');
  });

  it('blocks non-members from POST complete', async () => {
    const { controller } = buildController({ isMember: false });
    const req = { user: { _id: userId } } as never;

    await expect(controller.postComplete(req, workspaceId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delegates POST complete to onboarding service', async () => {
    const { controller, workspaceOnboardingService } = buildController();
    const req = { user: { _id: userId } } as never;

    const result = await controller.postComplete(req, workspaceId);

    expect(workspaceOnboardingService.completeOnboarding).toHaveBeenCalledWith(workspaceId);
    expect(result.onboardingStatus).toBe('completed');
  });

  it('blocks non-members from POST avatar', async () => {
    const { controller } = buildController({ isMember: false });
    const req = { user: { _id: userId }, isMultipart: () => true, parts: async function* () {} } as never;

    await expect(controller.postAvatar(req, workspaceId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
