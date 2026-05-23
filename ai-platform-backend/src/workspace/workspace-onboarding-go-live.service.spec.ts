import { BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { PLAN_LIMIT_WORKSPACE_BOTS_CODE } from '../entitlements/workspace-bot-limit.service';
import { WorkspaceOnboardingGoLiveService } from './workspace-onboarding-go-live.service';
import { legacyOnboardingDraftBotArchiveFilter } from './legacy-onboarding-draft-bot.util';
import { WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES } from '../workspaces/workspace-onboarding.types';
import { validateOnboardingDraftForGoLive } from '../workspaces/workspace-onboarding-go-live.validation';

describe('workspace onboarding go-live validation', () => {
  const completeDraft = {
    profile: {
      name: 'Ada Bot',
      shortDescription: 'Helper',
      description: 'Helps users',
      categories: [],
      avatarSource: '',
      imageUrl: '',
      avatarEmoji: '',
      avatarStorageKey: '',
      brandColor: '',
    },
    instructions: {
      description:
        'Be helpful when answering customer questions about pricing, product features, refunds, and support policies.',
      systemPrompt:
        'Be helpful when answering customer questions about pricing, product features, refunds, and support policies.',
      tone: 'friendly',
      behaviorPreset: 'default',
      responseLength: 'medium',
      maxTokens: 160,
    },
    knowledge: {
      knowledgeDescription: 'Product overview',
      faqs: [],
      snippets: [{ id: 's1', title: 'Overview', description: 'Product overview', createdAt: null, updatedAt: null }],
      qas: [],
    },
    goLive: {
      allowedOrigins: [{ origin: 'https://example.com', isActive: true }],
    },
    stepsCompleted: [],
    createdAt: null,
    updatedAt: null,
  };

  it('throws onboarding_profile_incomplete when name missing', () => {
    expect(() =>
      validateOnboardingDraftForGoLive({
        ...completeDraft,
        profile: { ...completeDraft.profile, name: '' },
      }),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          errorCode: WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES.profileIncomplete,
        }),
      }),
    );
  });

  it('throws onboarding_instructions_incomplete when instructions missing', () => {
    expect(() =>
      validateOnboardingDraftForGoLive({
        ...completeDraft,
        instructions: { ...completeDraft.instructions, description: '' },
      }),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          errorCode: WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES.instructionsIncomplete,
        }),
      }),
    );
  });

  it('allows go-live when profile description is empty but instructions are complete', () => {
    expect(() =>
      validateOnboardingDraftForGoLive({
        ...completeDraft,
        profile: { ...completeDraft.profile, description: '' },
      }),
    ).not.toThrow();
  });

  it('throws onboarding_knowledge_incomplete when no snippet or FAQ', () => {
    expect(() =>
      validateOnboardingDraftForGoLive({
        ...completeDraft,
        knowledge: { knowledgeDescription: '', faqs: [], snippets: [], qas: [] },
      }),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          errorCode: WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES.knowledgeIncomplete,
        }),
      }),
    );
  });

  it('allows go-live when staged documents exist without snippet or FAQ', () => {
    expect(() =>
      validateOnboardingDraftForGoLive(
        {
          ...completeDraft,
          knowledge: { knowledgeDescription: '', faqs: [], snippets: [], qas: [] },
        },
        { hasStagedDocuments: true },
      ),
    ).not.toThrow();
  });

  it('throws onboarding_origin_required when no active origin', () => {
    expect(() =>
      validateOnboardingDraftForGoLive({
        ...completeDraft,
        goLive: { allowedOrigins: [] },
      }),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          errorCode: WORKSPACE_ONBOARDING_GO_LIVE_ERROR_CODES.originRequired,
        }),
      }),
    );
  });
});

describe('WorkspaceOnboardingGoLiveService', () => {
  const workspaceId = new Types.ObjectId();
  const draftId = new Types.ObjectId();
  const userId = new Types.ObjectId().toString();
  const createdBotId = new Types.ObjectId();

  function completeOnboardingResponse() {
    return {
      workspaceId: String(workspaceId),
      onboardingStatus: 'in_progress',
      onboardingCurrentStep: 'go-live',
      onboardingDraftId: String(draftId),
      onboardingCreatedBotId: null,
      onboardingCompletedAt: null,
      draft: {
        profile: {
          name: 'Ada Bot',
          shortDescription: 'Helper',
          description: 'Helps users',
          categories: ['support'],
          avatarSource: '',
          imageUrl: '',
          avatarEmoji: '',
          avatarStorageKey: '',
      brandColor: '',
        },
    instructions: {
      description:
        'Be helpful when answering customer questions about pricing, product features, refunds, and support policies.',
      systemPrompt:
        'Be helpful when answering customer questions about pricing, product features, refunds, and support policies.',
          tone: 'friendly',
          behaviorPreset: 'default',
          responseLength: 'medium',
          maxTokens: 160,
        },
        knowledge: {
          knowledgeDescription: 'Overview',
          faqs: [{ question: 'Hours?', answer: '9-5' }],
          snippets: [{ id: 's1', title: 'Overview', description: 'Overview', createdAt: null, updatedAt: null }],
          qas: [
            {
              id: 'q1',
              title: 'Hours',
              questions: ['Hours?'],
              answer: '9-5',
              createdAt: null,
              updatedAt: null,
            },
          ],
        },
        goLive: {
          allowedOrigins: [{ origin: 'https://example.com', label: 'Site', isActive: true }],
        },
        stepsCompleted: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };
  }

  function buildService(overrides?: {
    workspace?: Record<string, unknown>;
    existingBot?: Record<string, unknown> | null;
    legacyDraftBots?: Array<{ _id: Types.ObjectId; clientDraftId?: string; status?: string }>;
    assertCanAdd?: () => Promise<void>;
  }) {
    let capturedArchiveFilter: Record<string, unknown> | null = null;
    const workspace: Record<string, unknown> = {
      _id: workspaceId,
      onboardingDraftId: draftId,
      onboardingCreatedBotId: null,
      ...overrides?.workspace,
    };

    const workspaceModel = {
      findById: jest.fn((id: Types.ObjectId) => ({
        lean: jest.fn(async () => (String(id) === String(workspaceId) ? { ...workspace } : null)),
      })),
      findOneAndUpdate: jest.fn((filter: Record<string, unknown>, update: Record<string, unknown>, opts?: { new?: boolean }) => ({
        lean: jest.fn(async () => {
          const id = (filter as { _id?: Types.ObjectId })._id;
          if (String(id) !== String(workspaceId)) return null;
          const hasBot = workspace.onboardingCreatedBotId != null;
          const canAttach = !hasBot && Boolean((filter as { $or?: unknown[] }).$or?.length);
          if (!canAttach && hasBot) return null;
          const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
          Object.assign(workspace, set);
          return opts?.new ? { ...workspace } : workspace;
        }),
      })),
      findByIdAndUpdate: jest.fn(async () => workspace),
    };

    const draftModel = {
      findByIdAndUpdate: jest.fn(async () => undefined),
    };

    const botModel = {
      find: jest.fn((filter: Record<string, unknown>) => {
        capturedArchiveFilter = filter;
        return {
          select: jest.fn(() => ({
            lean: jest.fn(async () =>
              (overrides?.legacyDraftBots ?? []).filter(
                (bot) =>
                  bot.status !== 'published' &&
                  typeof bot.clientDraftId === 'string' &&
                  bot.clientDraftId.trim().length > 0,
              ),
            ),
          })),
        };
      }),
      findOne: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(async () => overrides?.existingBot ?? null),
        })),
      })),
      deleteOne: jest.fn(async () => ({ deletedCount: 1 })),
    };

    const workspaceOnboardingService = {
      getOnboardingForWorkspace: jest.fn(async () => completeOnboardingResponse()),
      patchGoLive: jest.fn(async () => completeOnboardingResponse()),
    };

    const botsService = {
      createPublishedBotFromWorkspaceOnboarding: jest.fn(async () => ({
        botId: String(createdBotId),
        slug: 'ada-bot',
        name: 'Ada Bot',
        status: 'published' as const,
        accessKey: 'ak_test',
        secretKey: 'sk_test',
        visibility: 'public' as const,
        allowedOrigins: [{ origin: 'https://example.com', isActive: true }],
      })),
      remove: jest.fn(async () => ({ deleted: 'legacy', alreadyDeleted: false })),
    };

    const workspaceBotLimitService = {
      assertCanAddBotToWorkspace: jest.fn(overrides?.assertCanAdd ?? (async () => undefined)),
    };

    const workspaceOnboardingKnowledgeStagingService = {
      listStagedKnowledge: jest.fn(async () => ({ documents: [], datasheets: [] })),
      countPendingStagedKnowledge: jest.fn(async () => ({ documentCount: 0, datasheetCount: 0 })),
    };

    const workspaceOnboardingKbTransferJobService = {
      ensureQueuedTransferJob: jest.fn(async () => ({ jobId: new Types.ObjectId().toString(), created: true })),
    };

    const service = new WorkspaceOnboardingGoLiveService(
      workspaceModel as never,
      draftModel as never,
      botModel as never,
      workspaceOnboardingService as never,
      workspaceOnboardingKnowledgeStagingService as never,
      workspaceOnboardingKbTransferJobService as never,
      botsService as never,
      workspaceBotLimitService as never,
    );

    return {
      service,
      workspace,
      workspaceModel,
      botsService,
      workspaceBotLimitService,
      workspaceOnboardingService,
      workspaceOnboardingKbTransferJobService,
      getCapturedArchiveFilter: () => capturedArchiveFilter,
    };
  }

  it('creates published bot and durable onboarding KB transfer job without waiting for transfer', async () => {
    const { service, botsService, workspaceOnboardingKbTransferJobService } = buildService();

    const result = await service.goLive(String(workspaceId), userId, {});

    expect(botsService.createPublishedBotFromWorkspaceOnboarding).toHaveBeenCalledTimes(1);
    expect(workspaceOnboardingKbTransferJobService.ensureQueuedTransferJob).toHaveBeenCalledWith({
      workspaceId: String(workspaceId),
      botId: String(createdBotId),
      onboardingDraftId: String(draftId),
    });
    expect(result).toMatchObject({
      workspaceId: String(workspaceId),
      onboardingStatus: 'live_pending_install',
      onboardingCurrentStep: 'you-are-live',
      bot: { id: String(createdBotId), status: 'published', accessKey: 'ak_test' },
      knowledgeProcessingPending: true,
    });
  });

  it('returns existing bot idempotently when onboardingCreatedBotId is set', async () => {
    const existingBot = {
      _id: createdBotId,
      name: 'Ada Bot',
      slug: 'ada-bot',
      status: 'published',
      accessKey: 'ak_existing',
      secretKey: 'sk_existing',
      visibility: 'public',
      allowedOrigins: [{ origin: 'https://example.com', isActive: true }],
    };
    const { service, botsService } = buildService({
      workspace: { onboardingCreatedBotId: createdBotId },
      existingBot,
    });

    const result = await service.goLive(String(workspaceId), userId, {});

    expect(botsService.createPublishedBotFromWorkspaceOnboarding).not.toHaveBeenCalled();
    expect(result.bot.id).toBe(String(createdBotId));
    expect(result.bot.accessKey).toBe('ak_existing');
  });

  it('archives legacy onboarding drafts with clientDraftId before bot limit check', async () => {
    const legacyDraftId = new Types.ObjectId();
    const { service, botsService, workspaceBotLimitService, getCapturedArchiveFilter } = buildService({
      legacyDraftBots: [{ _id: legacyDraftId, clientDraftId: 'old-onboarding-draft', status: 'draft' }],
    });

    await service.goLive(String(workspaceId), userId, {});

    expect(getCapturedArchiveFilter()).toEqual(
      legacyOnboardingDraftBotArchiveFilter(String(workspaceId), { excludeBotId: null }),
    );
    expect(botsService.remove).toHaveBeenCalledWith(String(legacyDraftId));
    expect(workspaceBotLimitService.assertCanAddBotToWorkspace).toHaveBeenCalledWith(String(workspaceId));
    expect(botsService.createPublishedBotFromWorkspaceOnboarding).toHaveBeenCalledTimes(1);
  });

  it('does not archive manual draft bots without clientDraftId', async () => {
    const manualDraftId = new Types.ObjectId();
    const { service, botsService } = buildService({
      legacyDraftBots: [{ _id: manualDraftId, status: 'draft' }],
    });

    await service.goLive(String(workspaceId), userId, {});

    expect(botsService.remove).not.toHaveBeenCalled();
    expect(botsService.createPublishedBotFromWorkspaceOnboarding).toHaveBeenCalledTimes(1);
  });

  it('does not archive published bots and still blocks when limit reached', async () => {
    const publishedBotId = new Types.ObjectId();
    const { service, botsService } = buildService({
      legacyDraftBots: [{ _id: publishedBotId, clientDraftId: 'should-not-archive', status: 'published' }],
      assertCanAdd: async () => {
        throw new HttpException(
          { errorCode: PLAN_LIMIT_WORKSPACE_BOTS_CODE, message: 'limit' },
          HttpStatus.FORBIDDEN,
        );
      },
    });

    await expect(service.goLive(String(workspaceId), userId, {})).rejects.toMatchObject({
      response: { errorCode: PLAN_LIMIT_WORKSPACE_BOTS_CODE },
    });
    expect(botsService.remove).not.toHaveBeenCalled();
    expect(botsService.createPublishedBotFromWorkspaceOnboarding).not.toHaveBeenCalled();
  });

  it('succeeds when only a legacy onboarding draft with clientDraftId exists', async () => {
    const legacyDraftId = new Types.ObjectId();
    const { service, botsService } = buildService({
      legacyDraftBots: [{ _id: legacyDraftId, clientDraftId: 'legacy-only', status: 'draft' }],
    });

    await service.goLive(String(workspaceId), userId, {});

    expect(botsService.remove).toHaveBeenCalledWith(String(legacyDraftId));
    expect(botsService.createPublishedBotFromWorkspaceOnboarding).toHaveBeenCalledTimes(1);
  });

  it('propagates plan_limit_workspace_bots when a real counted bot exists', async () => {
    const { service } = buildService({
      assertCanAdd: async () => {
        throw new HttpException(
          { errorCode: PLAN_LIMIT_WORKSPACE_BOTS_CODE, message: 'limit' },
          HttpStatus.FORBIDDEN,
        );
      },
    });

    await expect(service.goLive(String(workspaceId), userId, {})).rejects.toMatchObject({
      response: { errorCode: PLAN_LIMIT_WORKSPACE_BOTS_CODE },
    });
  });

  it('does not duplicate transfer job when go-live is retried idempotently', async () => {
    const existingBot = {
      _id: createdBotId,
      name: 'Ada Bot',
      slug: 'ada-bot',
      status: 'published',
      accessKey: 'ak_existing',
      secretKey: 'sk_existing',
      visibility: 'public',
      allowedOrigins: [{ origin: 'https://example.com', isActive: true }],
    };
    const { service, botsService, workspaceBotLimitService, workspaceOnboardingKbTransferJobService } =
      buildService({
        workspace: { onboardingCreatedBotId: createdBotId, onboardingStatus: 'live_pending_install' },
        existingBot,
      });
    workspaceOnboardingKbTransferJobService.ensureQueuedTransferJob.mockResolvedValue({
      jobId: new Types.ObjectId().toString(),
      created: false,
    });

    const result = await service.goLive(String(workspaceId), userId, {});

    expect(botsService.createPublishedBotFromWorkspaceOnboarding).not.toHaveBeenCalled();
    expect(workspaceBotLimitService.assertCanAddBotToWorkspace).not.toHaveBeenCalled();
    expect(result.bot.id).toBe(String(createdBotId));
    expect(result.knowledgeProcessingPending).toBe(true);
    expect(workspaceOnboardingKbTransferJobService.ensureQueuedTransferJob).toHaveBeenCalledWith({
      workspaceId: String(workspaceId),
      botId: String(createdBotId),
      onboardingDraftId: String(draftId),
    });
  });

  it('rejects incomplete draft before bot creation', async () => {
    const { service, botsService, workspaceOnboardingService } = buildService();
    workspaceOnboardingService.getOnboardingForWorkspace.mockResolvedValue({
      ...completeOnboardingResponse(),
      draft: {
        ...completeOnboardingResponse().draft,
        profile: { ...completeOnboardingResponse().draft.profile, name: '' },
      },
    });

    await expect(service.goLive(String(workspaceId), userId, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(botsService.createPublishedBotFromWorkspaceOnboarding).not.toHaveBeenCalled();
  });
});
