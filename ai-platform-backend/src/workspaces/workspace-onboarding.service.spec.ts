jest.mock('../lib/s3', () => ({
  uploadPublic: jest.fn(async () => ({
    bucket: 'public-bucket',
    key: 'uploads/onboarding-drafts/draft/avatar/x.png',
    url: 'https://cdn.example.com/onboarding-avatar.png',
    visibility: 'public',
  })),
}));

import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { uploadPublic } from '../lib/s3';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';

function applyMongoSet(target: Record<string, unknown>, set: Record<string, unknown>): Record<string, unknown> {
  const next = { ...target };
  for (const [key, value] of Object.entries(set)) {
    if (!key.includes('.')) {
      next[key] = value;
      continue;
    }
    const parts = key.split('.');
    let cursor: Record<string, unknown> = next;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i]!;
      const existing = cursor[part];
      if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
        cursor[part] = {};
      }
      cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]!] = value;
  }
  return next;
}

describe('WorkspaceOnboardingService', () => {
  const workspaceId = new Types.ObjectId();
  const draftId = new Types.ObjectId();

  type Store = {
    workspace: Record<string, unknown>;
    draft: Record<string, unknown> | null;
    draftsByWorkspace: Map<string, Record<string, unknown>>;
  };

  function makeService(initial?: Partial<{ workspace: Record<string, unknown>; draft: Record<string, unknown> | null }>) {
    const store: Store = {
      workspace: {
        _id: workspaceId,
        name: 'Test workspace',
        onboardingStatus: 'not_started',
        onboardingCurrentStep: 'agent-profile',
        ...initial?.workspace,
      },
      draft: initial?.draft ?? null,
      draftsByWorkspace: new Map(),
    };

    const workspaceModel = {
      findById: jest.fn((id: Types.ObjectId) => ({
        lean: jest.fn(async () => {
          if (String(id) !== String(workspaceId)) return null;
          return { ...store.workspace };
        }),
      })),
      findOneAndUpdate: jest.fn((filter: Record<string, unknown>, update: Record<string, unknown>, opts?: { new?: boolean }) => ({
        lean: jest.fn(async () => {
          const id = (filter as { _id?: Types.ObjectId })._id;
          if (String(id) !== String(workspaceId)) return null;
          const hasDraft = store.workspace.onboardingDraftId != null;
          const filterAllowsAttach =
            !hasDraft &&
            ((filter as { $or?: Array<Record<string, unknown>> }).$or?.length ?? 0) > 0;
          if (!filterAllowsAttach && hasDraft) return null;

          const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
          store.workspace = applyMongoSet(store.workspace, set);
          return opts?.new ? { ...store.workspace } : store.workspace;
        }),
      })),
      findByIdAndUpdate: jest.fn((id: Types.ObjectId, update: Record<string, unknown>, opts?: { new?: boolean }) => ({
        lean: jest.fn(async () => {
          if (String(id) !== String(workspaceId)) return null;
          const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
          store.workspace = applyMongoSet(store.workspace, set);
          return opts?.new ? { ...store.workspace } : store.workspace;
        }),
      })),
    };

    const draftModel = {
      create: jest.fn(async (doc: Record<string, unknown>) => {
        const created = {
          _id: draftId,
          ...doc,
          profile: doc.profile ?? {},
          instructions: doc.instructions ?? {},
          knowledge: doc.knowledge ?? { faqs: [] },
          goLive: doc.goLive ?? { allowedOrigins: [] },
          stepsCompleted: doc.stepsCompleted ?? [],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        };
        store.draft = created;
        store.draftsByWorkspace.set(String(doc.workspaceId), created);
        return { _id: draftId, toObject: () => created };
      }),
      findById: jest.fn((id: Types.ObjectId) => ({
        lean: jest.fn(async () => {
          if (store.draft && String(store.draft._id) === String(id)) return { ...store.draft };
          return null;
        }),
      })),
      findByIdAndUpdate: jest.fn((id: Types.ObjectId, update: Record<string, unknown>, opts?: { new?: boolean }) => ({
        lean: jest.fn(async () => {
          if (!store.draft || String(store.draft._id) !== String(id)) return null;
          const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
          const addToSet = (update as { $addToSet?: Record<string, unknown> }).$addToSet ?? {};
          store.draft = applyMongoSet(store.draft ?? {}, set);
          if (addToSet.stepsCompleted) {
            const current = Array.isArray(store.draft.stepsCompleted) ? store.draft.stepsCompleted : [];
            if (!current.includes(addToSet.stepsCompleted)) {
              store.draft.stepsCompleted = [...current, addToSet.stepsCompleted];
            }
          }
          return opts?.new ? { ...store.draft } : store.draft;
        }),
      })),
      deleteOne: jest.fn(async () => ({ deletedCount: 1 })),
    };

    const service = new WorkspaceOnboardingService(workspaceModel as never, draftModel as never);
    return { service, store, workspaceModel, draftModel };
  }

  it('getOrCreate creates one draft and attaches to workspace', async () => {
    const { service, store, draftModel } = makeService();

    const result = await service.getOrCreateDraftForWorkspace(String(workspaceId));

    expect(draftModel.create).toHaveBeenCalledTimes(1);
    expect(String(result.workspace.onboardingDraftId)).toBe(String(draftId));
    expect(result.workspace.onboardingStatus).toBe('in_progress');
    expect(store.draft).not.toBeNull();
  });

  it('repeated getOrCreate returns same draft', async () => {
    const { service, draftModel } = makeService();

    const first = await service.getOrCreateDraftForWorkspace(String(workspaceId));
    const second = await service.getOrCreateDraftForWorkspace(String(workspaceId));

    expect(draftModel.create).toHaveBeenCalledTimes(1);
    expect(String(first.draft._id)).toBe(String(second.draft._id));
  });

  it('existing workspace without onboarding fields gets defaults in GET response', async () => {
    const { service } = makeService({
      workspace: {
        onboardingStatus: undefined,
        onboardingCurrentStep: undefined,
        onboardingDraftId: undefined,
      },
    });

    const response = await service.getOnboardingForWorkspace(String(workspaceId));

    expect(response.onboardingStatus).toBe('in_progress');
    expect(response.onboardingCurrentStep).toBe('agent-profile');
    expect(response.draft.profile.name).toBe('');
    expect(response.draft.instructions.tone).toBe('friendly');
  });

  it('patch profile saves expected fields', async () => {
    const { service } = makeService({
      workspace: { onboardingDraftId: draftId },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {},
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
      },
    });

    const response = await service.patchProfile(String(workspaceId), {
      name: 'Ada Bot',
      description: 'Helps users',
      shortDescription: 'Friendly helper',
      categories: ['support'],
    });

    expect(response.draft.profile).toMatchObject({
      name: 'Ada Bot',
      description: 'Helps users',
      shortDescription: 'Friendly helper',
      categories: ['support'],
    });
    expect(response.onboardingStatus).toBe('in_progress');
  });

  it('patch instructions saves expected fields with defaults', async () => {
    const { service } = makeService({
      workspace: { onboardingDraftId: draftId },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {},
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
      },
    });

    const response = await service.patchInstructions(String(workspaceId), {
      description:
        'Be concise and helpful when answering customer questions about pricing, features, and support policies.',
    });

    expect(response.draft.instructions).toMatchObject({
      description:
        'Be concise and helpful when answering customer questions about pricing, features, and support policies.',
      systemPrompt:
        'Be concise and helpful when answering customer questions about pricing, features, and support policies.',
      tone: 'friendly',
      behaviorPreset: 'default',
      responseLength: 'medium',
      maxTokens: 160,
    });
  });

  it('patch knowledge saves snippet and trims empty faq rows', async () => {
    const { service } = makeService({
      workspace: { onboardingDraftId: draftId },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {},
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
      },
    });

    const response = await service.patchKnowledge(String(workspaceId), {
      knowledgeDescription: 'Product docs summary',
      faqs: [
        { question: 'Hours?', answer: '9-5' },
        { question: '  ', answer: '  ' },
      ],
    });

    expect(response.draft.knowledge.knowledgeDescription).toBe('Product docs summary');
    expect(response.draft.knowledge.faqs).toEqual([{ question: 'Hours?', answer: '9-5' }]);
  });

  it('patch go-live saves allowed origin', async () => {
    const { service } = makeService({
      workspace: { onboardingDraftId: draftId },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {},
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
      },
    });

    const response = await service.patchGoLive(String(workspaceId), {
      allowedOrigins: [{ origin: 'https://example.com', label: 'Marketing site', isActive: true }],
    });

    expect(response.draft.goLive.allowedOrigins).toEqual([
      { origin: 'https://example.com', label: 'Marketing site', isActive: true },
    ]);
  });

  it('patch go-live rejects more than 3 unique allowed origins', async () => {
    const { service } = makeService({
      workspace: { onboardingDraftId: draftId },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {},
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
      },
    });

    await expect(
      service.patchGoLive(String(workspaceId), {
        allowedOrigins: [
          { origin: 'https://a.example.com', isActive: true },
          { origin: 'https://b.example.com', isActive: true },
          { origin: 'https://c.example.com', isActive: true },
          { origin: 'https://d.example.com', isActive: true },
        ],
      }),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'onboarding_allowed_origins_limit_reached',
      },
    });
  });

  it('patch go-live deduplicates allowed origins', async () => {
    const { service } = makeService({
      workspace: { onboardingDraftId: draftId },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {},
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
      },
    });

    const response = await service.patchGoLive(String(workspaceId), {
      allowedOrigins: [
        { origin: 'https://Example.com', isActive: true },
        { origin: 'https://example.com', isActive: true },
        { origin: 'https://shop.example.com', isActive: true },
      ],
    });

    expect(response.draft.goLive.allowedOrigins).toHaveLength(2);
  });

  it('does not create bot documents through onboarding service APIs', async () => {
    const { service, draftModel, workspaceModel } = makeService();
    expect(service).not.toHaveProperty('botModel');
    expect(Object.keys(draftModel)).not.toContain('bot');
    expect(Object.keys(workspaceModel)).not.toContain('bot');
  });

  it('complete fails before live bot exists', async () => {
    const { service } = makeService({
      workspace: {
        onboardingStatus: 'in_progress',
        onboardingDraftId: draftId,
      },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {},
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
      },
    });

    await expect(service.completeOnboarding(String(workspaceId))).rejects.toBeInstanceOf(BadRequestException);
    try {
      await service.completeOnboarding(String(workspaceId));
      throw new Error('expected BadRequestException');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const body = (e as BadRequestException).getResponse() as { errorCode?: string; message?: string };
      expect(body.errorCode).toBe('onboarding_not_live');
      expect(body.message).toBe('Complete onboarding after your agent is live.');
    }
  });

  it('complete succeeds after live_pending_install with createdBotId', async () => {
    const botId = new Types.ObjectId();
    const { service, store } = makeService({
      workspace: {
        onboardingStatus: 'live_pending_install',
        onboardingCurrentStep: 'you-are-live',
        onboardingDraftId: draftId,
        onboardingCreatedBotId: botId,
      },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {},
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: ['go-live'],
      },
    });

    const response = await service.completeOnboarding(String(workspaceId));

    expect(response.onboardingStatus).toBe('completed');
    expect(response.onboardingCurrentStep).toBe('you-are-live');
    expect(response.onboardingCreatedBotId).toBe(String(botId));
    expect(response.onboardingCompletedAt).toBeTruthy();
    expect(response.draft.stepsCompleted).toContain('you-are-live');
    expect(store.workspace.onboardingStatus).toBe('completed');
  });

  it('complete is idempotent when already completed', async () => {
    const botId = new Types.ObjectId();
    const completedAt = new Date('2026-05-01T12:00:00.000Z');
    const { service, draftModel } = makeService({
      workspace: {
        onboardingStatus: 'completed',
        onboardingCurrentStep: 'you-are-live',
        onboardingDraftId: draftId,
        onboardingCreatedBotId: botId,
        onboardingCompletedAt: completedAt,
      },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {},
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: ['you-are-live'],
      },
    });

    const response = await service.completeOnboarding(String(workspaceId));

    expect(response.onboardingStatus).toBe('completed');
    expect(response.onboardingCompletedAt).toBe(completedAt.toISOString());
    expect(draftModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('complete adds you-are-live to stepsCompleted', async () => {
    const botId = new Types.ObjectId();
    const { service } = makeService({
      workspace: {
        onboardingStatus: 'live_pending_install',
        onboardingDraftId: draftId,
        onboardingCreatedBotId: botId,
      },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {},
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: ['agent-profile', 'go-live'],
      },
    });

    const response = await service.completeOnboarding(String(workspaceId));

    expect(response.draft.stepsCompleted).toEqual(
      expect.arrayContaining(['agent-profile', 'go-live', 'you-are-live']),
    );
  });

  it('uploadAvatar stores staged profile fields without creating bots', async () => {
    const { service, draftModel } = makeService({
      workspace: { onboardingDraftId: draftId },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {
          name: 'Ada Bot',
          shortDescription: 'Helper',
          brandColor: '#112233',
          categories: ['support'],
        },
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
      },
    });

    const response = await service.uploadAvatar(String(workspaceId), {
      buffer: Buffer.from('fake-image'),
      originalName: 'avatar.png',
      mime: 'image/png',
    });

    expect(uploadPublic).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: `uploads/onboarding-drafts/${String(draftId)}/avatar`,
        contentType: 'image/png',
      }),
    );
    expect(response.draft.profile).toMatchObject({
      name: 'Ada Bot',
      shortDescription: 'Helper',
      brandColor: '#112233',
      categories: ['support'],
      avatarSource: 'upload',
      imageUrl: 'https://cdn.example.com/onboarding-avatar.png',
      avatarStorageKey: 'uploads/onboarding-drafts/draft/avatar/x.png',
      avatarEmoji: '',
    });
    expect(draftModel.create).not.toHaveBeenCalled();
  });

  it('patch profile merges partial fields without wiping omitted profile data', async () => {
    const { service } = makeService({
      workspace: { onboardingDraftId: draftId },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {
          name: 'Ada Bot',
          shortDescription: 'Helper',
          brandColor: '#112233',
          categories: ['support'],
          description: 'Legacy profile blurb',
        },
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
      },
    });

    const response = await service.patchProfile(String(workspaceId), {
      brandColor: '#AABBCC',
    });

    expect(response.draft.profile).toMatchObject({
      name: 'Ada Bot',
      shortDescription: 'Helper',
      brandColor: '#AABBCC',
      categories: ['support'],
      description: 'Legacy profile blurb',
    });
  });

  it('patch instructions rejects text under minimum length', async () => {
    const { service } = makeService({
      workspace: { onboardingDraftId: draftId },
      draft: {
        _id: draftId,
        workspaceId,
        profile: {},
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
      },
    });

    await expect(
      service.patchInstructions(String(workspaceId), { description: 'Too short.' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('patchProgress advances onboardingCurrentStep when a step is completed', async () => {
    const { service } = makeService({
      workspace: {
        onboardingDraftId: draftId,
        onboardingStatus: 'in_progress',
        onboardingCurrentStep: 'agent-profile',
      },
      draft: {
        _id: draftId,
        workspaceId,
        profile: { name: 'Ada Bot' },
        instructions: {},
        knowledge: { faqs: [] },
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
      },
    });

    const response = await service.patchProgress(String(workspaceId), {
      completedStep: 'agent-profile',
    });

    expect(response.draft.stepsCompleted).toContain('agent-profile');
    expect(response.onboardingCurrentStep).toBe('describe-profile');
  });
});
