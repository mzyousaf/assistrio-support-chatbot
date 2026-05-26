import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WorkspaceOnboardingKnowledgeStagingService } from './workspace-onboarding-knowledge-staging.service';

jest.mock('../lib/s3', () => ({
  uploadToS3: jest.fn(async () => ({ bucket: 'private-bucket', key: 'uploads/onboarding-drafts/x/doc.pdf' })),
}));

import { uploadToS3 } from '../lib/s3';

describe('WorkspaceOnboardingKnowledgeStagingService', () => {
  const workspaceId = String(new Types.ObjectId());
  const draftId = String(new Types.ObjectId());

  const onboardingDraft = {
    workspaceId,
    onboardingDraftId: draftId,
    draft: {
      profile: {
        name: 'Bot',
        shortDescription: '',
        description: 'Desc',
        categories: [],
        avatarSource: '',
        imageUrl: '',
        avatarEmoji: '',
        avatarStorageKey: '',
        brandColor: '',
      },
      instructions: {
        description: 'x'.repeat(80),
        systemPrompt: '',
        tone: 'friendly',
        behaviorPreset: 'default',
        responseLength: 'medium' as const,
        maxTokens: 160,
      },
      knowledge: { knowledgeDescription: '', faqs: [] },
      goLive: { allowedOrigins: [] },
      stepsCompleted: [],
      createdAt: null,
      updatedAt: null,
    },
  };

  function buildService(overrides?: { isMember?: boolean; stagedRows?: unknown[] }) {
    const createdRows: unknown[] = [];
    const deletedManyCalls: unknown[] = [];
    const stagingModel = {
      find: jest.fn(() => ({
        sort: jest.fn(() => ({
          lean: jest.fn(async () => overrides?.stagedRows ?? []),
        })),
        lean: jest.fn(async () => overrides?.stagedRows ?? []),
      })),
      create: jest.fn(async (doc: unknown) => {
        createdRows.push(doc);
        return doc;
      }),
      findOneAndDelete: jest.fn(async () => null),
      deleteMany: jest.fn(async (filter: unknown) => {
        deletedManyCalls.push(filter);
        return { deletedCount: 2 };
      }),
    };

    const workspaceOnboardingService = {
      getOnboardingForWorkspace: jest.fn(async () => ({
        ...onboardingDraft,
        onboardingStatus: 'in_progress',
        onboardingCurrentStep: 'knowledge-base',
        onboardingCreatedBotId: null,
        onboardingCompletedAt: null,
      })),
    };

    const entitlementsService = {
      resolveForWorkspace: jest.fn(async () => ({
        workspaceId,
        planKey: 'free',
        planName: 'Free',
        subscriptionStatus: 'free',
        botLimit: 1,
        memberLimit: 1,
        monthlyAiCredits: 100,
        kbStorageMbPerBot: 5,
        kbStorageBytesPerBot: 5 * 1024 * 1024,
        maxKbStorageMbPerBot: 40,
        maxKbStorageBytesPerBot: 40 * 1024 * 1024,
        analyticsHistoryDays: 7,
        canExportReports: false,
        showPoweredByAssistrio: true,
        canRemoveBranding: false,
        activeAddons: [],
        topUpCreditsRemaining: 0,
      })),
    };

    const service = new WorkspaceOnboardingKnowledgeStagingService(
      stagingModel as never,
      workspaceOnboardingService as never,
      entitlementsService as never,
    );

    return { service, stagingModel, workspaceOnboardingService, createdRows, deletedManyCalls };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploadDocuments saves staged item without creating a bot', async () => {
    const { service, stagingModel, workspaceOnboardingService, createdRows } = buildService();

    await service.uploadDocuments(workspaceId, [
      {
        buffer: Buffer.from('hello'),
        originalName: 'notes.txt',
        fileMimetype: 'text/plain',
        ext: 'txt',
      },
    ]);

    expect(uploadToS3).toHaveBeenCalled();
    expect(stagingModel.create).toHaveBeenCalledTimes(1);
    expect(createdRows[0]).toMatchObject({
      sourceType: 'document',
      originalName: 'notes.txt',
      status: 'uploaded',
    });
    expect(workspaceOnboardingService.getOnboardingForWorkspace).toHaveBeenCalled();
    const onboarding = await workspaceOnboardingService.getOnboardingForWorkspace();
    expect(onboarding.onboardingCreatedBotId).toBeNull();
  });

  it('uploadDatasheet saves staged item without creating a bot', async () => {
    const { service, stagingModel, createdRows } = buildService();
    const csv = Buffer.from('name,role\nAda,Support\n');

    await service.uploadDatasheet(workspaceId, {
      buffer: csv,
      originalName: 'team.csv',
      fileMimetype: 'text/csv',
    });

    expect(stagingModel.create).toHaveBeenCalledTimes(1);
    expect(createdRows[0]).toMatchObject({
      sourceType: 'datasheet',
      originalName: 'team.csv',
      status: 'uploaded',
    });
  });

  it('deleteStagedItem throws when item missing', async () => {
    const { service } = buildService();
    await expect(
      service.deleteStagedItem(workspaceId, String(new Types.ObjectId()), 'document'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bulkDeleteStagedItems deletes only matching workspace draft rows', async () => {
    const id1 = String(new Types.ObjectId());
    const id2 = String(new Types.ObjectId());
    const { service, stagingModel } = buildService();

    const res = await service.bulkDeleteStagedItems(workspaceId, [id1, id2, 'not-an-object-id'], 'document');

    expect(stagingModel.deleteMany).toHaveBeenCalledTimes(1);
    expect(res.deletedCount).toBe(2);
    expect((res as { onboardingCreatedBotId?: string | null }).onboardingCreatedBotId).toBeNull();
  });

  it('listStagedKnowledge returns documents and datasheets newest first', async () => {
    const older = new Date('2024-01-01T00:00:00.000Z');
    const newer = new Date('2024-01-05T00:00:00.000Z');
    const docOldId = new Types.ObjectId();
    const docNewId = new Types.ObjectId();
    const sheetOldId = new Types.ObjectId();
    const sheetNewId = new Types.ObjectId();
    const { service } = buildService({
      stagedRows: [
        {
          _id: docOldId,
          sourceType: 'document',
          originalName: 'old.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 10,
          status: 'uploaded',
          createdAt: older,
          updatedAt: older,
        },
        {
          _id: docNewId,
          sourceType: 'document',
          originalName: 'new.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 10,
          status: 'uploaded',
          createdAt: newer,
          updatedAt: newer,
        },
        {
          _id: sheetOldId,
          sourceType: 'datasheet',
          originalName: 'old.csv',
          mimeType: 'text/csv',
          sizeBytes: 10,
          status: 'uploaded',
          createdAt: older,
          updatedAt: older,
        },
        {
          _id: sheetNewId,
          sourceType: 'datasheet',
          originalName: 'new.csv',
          mimeType: 'text/csv',
          sizeBytes: 10,
          status: 'uploaded',
          createdAt: newer,
          updatedAt: newer,
        },
      ],
    });

    const result = await service.listStagedKnowledge(draftId);
    expect(result.documents.map((row) => row.originalName)).toEqual(['new.pdf', 'old.pdf']);
    expect(result.datasheets.map((row) => row.originalName)).toEqual(['new.csv', 'old.csv']);
  });
});
