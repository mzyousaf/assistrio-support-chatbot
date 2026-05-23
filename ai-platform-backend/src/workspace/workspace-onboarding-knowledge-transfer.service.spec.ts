import { Types } from 'mongoose';
import { WorkspaceOnboardingKnowledgeTransferService } from './workspace-onboarding-knowledge-transfer.service';

describe('WorkspaceOnboardingKnowledgeTransferService', () => {
  const botId = new Types.ObjectId().toString();
  const draftId = new Types.ObjectId().toString();
  const stagedDocId = new Types.ObjectId();
  const createdDocId = new Types.ObjectId();

  function buildService(overrides?: {
    rows?: Array<Record<string, unknown>>;
    updateOne?: jest.Mock;
  }) {
    const rows = overrides?.rows ?? [
      {
        _id: stagedDocId,
        sourceType: 'document',
        originalName: 'guide.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        storageKey: 'staging/guide.pdf',
        s3Bucket: 'bucket',
        status: 'uploaded',
        metadata: {},
      },
    ];

    const stagingModel = {
      find: jest.fn(() => ({
        sort: jest.fn(() => ({
          lean: jest.fn(async () => rows),
        })),
      })),
      updateOne: overrides?.updateOne ?? jest.fn(async () => ({ modifiedCount: 1 })),
    };

    const documentsService = {
      create: jest.fn(async () => ({ _id: createdDocId })),
    };

    const ingestionService = {
      createQueuedJob: jest.fn(async () => undefined),
    };

    const knowledgeBaseItemService = {
      upsertTableKnowledgeItemsForBot: jest.fn(async () => ({ upserted: 1, deactivated: 0 })),
    };

    const service = new WorkspaceOnboardingKnowledgeTransferService(
      stagingModel as never,
      documentsService as never,
      ingestionService as never,
      knowledgeBaseItemService as never,
    );

    return { service, stagingModel, documentsService, ingestionService, knowledgeBaseItemService };
  }

  it('transfers uploaded documents and queues extraction', async () => {
    const { service, documentsService, ingestionService } = buildService();

    await service.transferStagedKnowledgeForBot(botId, draftId);

    expect(documentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ botId, fileName: 'guide.pdf', status: 'queued' }),
    );
    expect(ingestionService.createQueuedJob).toHaveBeenCalledWith(botId, String(createdDocId), {
      markTrainingQueued: true,
      timesOverride: expect.objectContaining({
        lastQueuedAt: expect.any(Date),
        runAfter: expect.any(Date),
      }),
    });
  });

  it('includes transfer_pending and failed rows for retry', async () => {
    const { service, stagingModel, documentsService } = buildService({
      rows: [
        {
          _id: stagedDocId,
          sourceType: 'document',
          originalName: 'retry.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 500,
          storageKey: 'staging/retry.pdf',
          status: 'failed',
          createdKnowledgeItemId: createdDocId,
          metadata: {},
        },
      ],
    });

    await service.transferStagedKnowledgeForBot(botId, draftId);

    expect(stagingModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $in: ['uploaded', 'failed', 'transfer_pending'] },
      }),
    );
    expect(documentsService.create).not.toHaveBeenCalled();
  });

  it('transfers datasheets with onboarding forceInitialTraining options', async () => {
    const { service, knowledgeBaseItemService } = buildService({
      rows: [
        {
          _id: stagedDocId,
          sourceType: 'datasheet',
          originalName: 'products.csv',
          sizeBytes: 200,
          storageKey: 'staging/products.csv',
          status: 'uploaded',
          metadata: {
            columns: ['SKU', 'Name'],
            rows: [['1', 'Widget']],
            sheetName: 'Products',
          },
        },
      ],
    });

    await service.transferStagedKnowledgeForBot(botId, draftId);

    expect(knowledgeBaseItemService.upsertTableKnowledgeItemsForBot).toHaveBeenCalledWith(
      botId,
      [
        expect.objectContaining({
          title: 'Products',
          columns: ['SKU', 'Name'],
          rows: [['1', 'Widget']],
        }),
      ],
      { forceInitialTraining: true },
    );
  });
});
