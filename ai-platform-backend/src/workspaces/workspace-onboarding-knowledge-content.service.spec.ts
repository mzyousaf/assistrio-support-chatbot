import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { LEGACY_ONBOARDING_SNIPPET_ID, legacyFaqQaId } from './workspace-onboarding-knowledge-normalize.util';
import { WorkspaceOnboardingKnowledgeContentService } from './workspace-onboarding-knowledge-content.service';

function applyDraftKnowledgeSet(draftKnowledge: Record<string, unknown>, set: Record<string, unknown>) {
  if (set['knowledge.snippets'] != null) draftKnowledge.snippets = set['knowledge.snippets'];
  if (set['knowledge.qas'] != null) draftKnowledge.qas = set['knowledge.qas'];
  if (set['knowledge.knowledgeDescription'] != null) {
    draftKnowledge.knowledgeDescription = set['knowledge.knowledgeDescription'];
  }
  if (set['knowledge.faqs'] != null) draftKnowledge.faqs = set['knowledge.faqs'];
}

describe('WorkspaceOnboardingKnowledgeContentService delete', () => {
  const workspaceId = new Types.ObjectId().toString();
  const draftId = new Types.ObjectId();

  function buildService(draftKnowledge: Record<string, unknown>) {
    const draftDoc = { _id: draftId, knowledge: draftKnowledge };
    const draftModel = {
      findById: jest.fn(() => ({
        lean: jest.fn(async () => draftDoc),
      })),
      findByIdAndUpdate: jest.fn(async (_id: unknown, update: { $set?: Record<string, unknown> }) => {
        applyDraftKnowledgeSet(draftDoc.knowledge as Record<string, unknown>, update.$set ?? {});
        return draftDoc;
      }),
    };

    const onboardingResponse = {
      workspaceId,
      onboardingDraftId: String(draftId),
      draft: {
        profile: { name: 'Test' },
        instructions: { description: 'x'.repeat(80) },
        knowledge: draftKnowledge,
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
        createdAt: null,
        updatedAt: null,
      },
    };

    const workspaceOnboardingService = {
      getOnboardingForWorkspace: jest.fn(async () => onboardingResponse),
    };

    const stagingService = {
      attachStagedKnowledgeToResponse: jest.fn(async (res: unknown) => res),
    };

    const service = new WorkspaceOnboardingKnowledgeContentService(
      draftModel as never,
      workspaceOnboardingService as never,
      stagingService as never,
    );

    return { service, draftModel, draftDoc, workspaceOnboardingService };
  }

  it('deletes legacy knowledgeDescription virtual snippet', async () => {
    const { service, draftModel } = buildService({
      knowledgeDescription: 'Legacy body',
      faqs: [],
      snippets: [],
      qas: [],
    });

    await service.deleteSnippet(workspaceId, LEGACY_ONBOARDING_SNIPPET_ID);

    expect(draftModel.findByIdAndUpdate).toHaveBeenCalled();
    const update = draftModel.findByIdAndUpdate.mock.calls[0]?.[1] as { $set: Record<string, unknown> };
    expect(update.$set['knowledge.snippets']).toEqual([]);
    expect(update.$set['knowledge.knowledgeDescription']).toBe('');
  });

  it('deletes explicit snippet by id', async () => {
    const { service, draftModel } = buildService({
      knowledgeDescription: '',
      faqs: [],
      snippets: [{ id: 's1', title: 'A', description: 'Body A' }],
      qas: [],
    });

    await service.deleteSnippet(workspaceId, 's1');

    const update = draftModel.findByIdAndUpdate.mock.calls[0]?.[1] as { $set: Record<string, unknown> };
    expect(update.$set['knowledge.snippets']).toEqual([]);
  });

  it('returns not found for unknown snippet id', async () => {
    const { service } = buildService({
      knowledgeDescription: '',
      faqs: [],
      snippets: [{ id: 's1', title: 'A', description: 'Body A' }],
      qas: [],
    });

    await expect(service.deleteSnippet(workspaceId, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes legacy FAQ virtual Q&A', async () => {
    const { service, draftModel } = buildService({
      knowledgeDescription: '',
      faqs: [{ question: 'Hours?', answer: '9-5' }],
      snippets: [],
      qas: [],
    });

    await service.deleteQa(workspaceId, legacyFaqQaId(0));

    const update = draftModel.findByIdAndUpdate.mock.calls[0]?.[1] as { $set: Record<string, unknown> };
    expect(update.$set['knowledge.faqs']).toEqual([]);
  });

  it('returns not found for unknown Q&A id', async () => {
    const { service } = buildService({
      knowledgeDescription: '',
      faqs: [],
      snippets: [],
      qas: [{ id: 'q1', title: 'Q', questions: ['Q?'], answer: 'A' }],
    });

    await expect(service.deleteQa(workspaceId, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('WorkspaceOnboardingKnowledgeContentService bulk delete', () => {
  const workspaceId = new Types.ObjectId().toString();
  const draftId = new Types.ObjectId();

  function buildService(draftKnowledge: Record<string, unknown>) {
    const draftDoc = { _id: draftId, knowledge: draftKnowledge };
    const draftModel = {
      findById: jest.fn(() => ({
        lean: jest.fn(async () => draftDoc),
      })),
      findByIdAndUpdate: jest.fn(async (_id: unknown, update: { $set?: Record<string, unknown> }) => {
        applyDraftKnowledgeSet(draftDoc.knowledge as Record<string, unknown>, update.$set ?? {});
        return draftDoc;
      }),
    };

    const onboardingResponse = {
      workspaceId,
      onboardingDraftId: String(draftId),
      draft: {
        profile: { name: 'Test' },
        instructions: { description: 'x'.repeat(80) },
        knowledge: draftKnowledge,
        goLive: { allowedOrigins: [] },
        stepsCompleted: [],
        createdAt: null,
        updatedAt: null,
      },
    };

    const workspaceOnboardingService = {
      getOnboardingForWorkspace: jest.fn(async () => onboardingResponse),
    };

    const stagingService = {
      attachStagedKnowledgeToResponse: jest.fn(async (res: unknown) => res),
    };

    const service = new WorkspaceOnboardingKnowledgeContentService(
      draftModel as never,
      workspaceOnboardingService as never,
      stagingService as never,
    );

    return { service, draftModel, draftDoc };
  }

  it('bulkDeleteSnippets removes multiple explicit snippets in one persist', async () => {
    const { service, draftModel } = buildService({
      knowledgeDescription: '',
      faqs: [],
      snippets: [
        { id: 's1', title: 'A', description: 'Body A' },
        { id: 's2', title: 'B', description: 'Body B' },
        { id: 's3', title: 'C', description: 'Body C' },
      ],
      qas: [],
    });

    const res = await service.bulkDeleteSnippets(workspaceId, ['s1', 's3']);

    expect(res.deletedCount).toBe(2);
    const update = draftModel.findByIdAndUpdate.mock.calls[0]?.[1] as { $set: Record<string, unknown> };
    expect(update.$set['knowledge.snippets']).toEqual([
      expect.objectContaining({ id: 's2', title: 'B' }),
    ]);
  });

  it('bulkDeleteQas removes multiple explicit Q&A items in one persist', async () => {
    const { service, draftModel } = buildService({
      knowledgeDescription: '',
      faqs: [],
      snippets: [],
      qas: [
        { id: 'q1', title: 'Q1', questions: ['Q1?'], answer: 'A1' },
        { id: 'q2', title: 'Q2', questions: ['Q2?'], answer: 'A2' },
      ],
    });

    const res = await service.bulkDeleteQas(workspaceId, ['q1', 'q2']);

    expect(res.deletedCount).toBe(2);
    const update = draftModel.findByIdAndUpdate.mock.calls[0]?.[1] as { $set: Record<string, unknown> };
    expect(update.$set['knowledge.qas']).toEqual([]);
  });
});

describe('WorkspaceOnboardingKnowledgeContentService timestamps', () => {
  const workspaceId = new Types.ObjectId().toString();
  const draftId = new Types.ObjectId();

  function serializeKnowledgeForApiResponse(knowledge: Record<string, unknown>): Record<string, unknown> {
    const mapRow = (row: Record<string, unknown>) => ({
      ...row,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : typeof row.createdAt === 'string'
            ? row.createdAt
            : row.createdAt ?? null,
      updatedAt:
        row.updatedAt instanceof Date
          ? row.updatedAt.toISOString()
          : typeof row.updatedAt === 'string'
            ? row.updatedAt
            : row.updatedAt ?? null,
    });

    return {
      ...knowledge,
      snippets: Array.isArray(knowledge.snippets)
        ? (knowledge.snippets as Array<Record<string, unknown>>).map(mapRow)
        : [],
      qas: Array.isArray(knowledge.qas)
        ? (knowledge.qas as Array<Record<string, unknown>>).map(mapRow)
        : [],
    };
  }

  function buildService(draftKnowledge: Record<string, unknown>) {
    const draftDoc = { _id: draftId, knowledge: draftKnowledge };
    const draftModel = {
      findById: jest.fn(() => ({
        lean: jest.fn(async () => draftDoc),
      })),
      findByIdAndUpdate: jest.fn(async (_id: unknown, update: { $set?: Record<string, unknown> }) => {
        applyDraftKnowledgeSet(draftDoc.knowledge as Record<string, unknown>, update.$set ?? {});
        return draftDoc;
      }),
    };

    const workspaceOnboardingService = {
      getOnboardingForWorkspace: jest.fn(async () => ({
        workspaceId,
        onboardingDraftId: String(draftId),
        draft: {
          profile: { name: 'Test' },
          instructions: { description: 'x'.repeat(80) },
          knowledge: serializeKnowledgeForApiResponse(draftDoc.knowledge as Record<string, unknown>),
          goLive: { allowedOrigins: [] },
          stepsCompleted: [],
          createdAt: null,
          updatedAt: null,
        },
      })),
    };

    const stagingService = {
      attachStagedKnowledgeToResponse: jest.fn(async (res: unknown) => res),
    };

    return {
      service: new WorkspaceOnboardingKnowledgeContentService(
        draftModel as never,
        workspaceOnboardingService as never,
        stagingService as never,
      ),
      draftModel,
    };
  }

  it('updateSnippet preserves unchanged snippet updatedAt', async () => {
    const s1Updated = '2024-01-01T00:00:00.000Z';
    const s2Updated = '2024-01-02T00:00:00.000Z';
    const { service, draftModel } = buildService({
      knowledgeDescription: '',
      faqs: [],
      snippets: [
        {
          id: 's1',
          title: 'A',
          description: 'Body A',
          createdAt: new Date(s1Updated),
          updatedAt: new Date(s1Updated),
        },
        {
          id: 's2',
          title: 'B',
          description: 'Body B',
          createdAt: new Date(s2Updated),
          updatedAt: new Date(s2Updated),
        },
      ],
      qas: [],
    });

    await service.updateSnippet(workspaceId, 's2', { title: 'B edited' });

    const update = draftModel.findByIdAndUpdate.mock.calls[0]?.[1] as { $set: Record<string, unknown> };
    const snippets = update.$set['knowledge.snippets'] as Array<{ id: string; updatedAt: Date }>;
    const s1 = snippets.find((row) => row.id === 's1')!;
    const s2 = snippets.find((row) => row.id === 's2')!;
    expect(s1.updatedAt.toISOString()).toBe(s1Updated);
    expect(s2.updatedAt.toISOString()).not.toBe(s2Updated);
  });

  it('listSnippets returns latest-first order', async () => {
    const { service } = buildService({
      knowledgeDescription: '',
      faqs: [],
      snippets: [
        { id: 's1', title: 'A', description: 'A', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
        { id: 's2', title: 'B', description: 'B', createdAt: new Date('2024-01-03'), updatedAt: new Date('2024-01-03') },
      ],
      qas: [],
    });

    const res = await service.listSnippets(workspaceId);
    expect(res.snippets.map((row) => row.id)).toEqual(['s2', 's1']);
  });

  it('listSnippets returns C/B/A then A/C/B after editing A', async () => {
    const { service, draftModel } = buildService({
      knowledgeDescription: '',
      faqs: [],
      snippets: [
        { id: 'a', title: 'A', description: 'a', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') },
        { id: 'b', title: 'B', description: 'b', createdAt: new Date('2024-01-02'), updatedAt: new Date('2024-01-02') },
        { id: 'c', title: 'C', description: 'c', createdAt: new Date('2024-01-03'), updatedAt: new Date('2024-01-03') },
      ],
      qas: [],
    });

    const initial = await service.listSnippets(workspaceId);
    expect(initial.snippets.map((row) => row.id)).toEqual(['c', 'b', 'a']);

    await service.updateSnippet(workspaceId, 'a', { title: 'A edited' });

    const update = draftModel.findByIdAndUpdate.mock.calls.at(-1)?.[1] as { $set: Record<string, unknown> };
    const persisted = update.$set['knowledge.snippets'] as Array<{ id: string; updatedAt: Date }>;
    const edited = persisted.find((row) => row.id === 'a')!;
    const untouched = persisted.find((row) => row.id === 'c')!;
    expect(edited.updatedAt.getTime()).toBeGreaterThan(new Date('2024-01-03T00:00:00.000Z').getTime());
    expect(untouched.updatedAt.toISOString()).toBe('2024-01-03T00:00:00.000Z');

    const afterEdit = await service.listSnippets(workspaceId);
    expect(afterEdit.snippets.map((row) => row.id)).toEqual(['a', 'c', 'b']);
    expect(untouched.updatedAt.toISOString()).toBe('2024-01-03T00:00:00.000Z');
  });

  it('listQas returns C/B/A then A/C/B after editing A', async () => {
    const { service } = buildService({
      knowledgeDescription: '',
      faqs: [],
      snippets: [],
      qas: [
        {
          id: 'a',
          title: 'A',
          questions: ['?'],
          answer: 'a',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'b',
          title: 'B',
          questions: ['?'],
          answer: 'b',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'c',
          title: 'C',
          questions: ['?'],
          answer: 'c',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        },
      ],
    });

    const initial = await service.listQas(workspaceId);
    expect(initial.qas.map((row) => row.id)).toEqual(['c', 'b', 'a']);

    await service.updateQa(workspaceId, 'a', { title: 'A edited' });

    const afterEdit = await service.listQas(workspaceId);
    expect(afterEdit.qas.map((row) => row.id)).toEqual(['a', 'c', 'b']);
  });
});
