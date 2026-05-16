import { Types } from 'mongoose';
import { BotsService } from './bots.service';

describe('BotsService.updateWorkspaceBot knowledgeReplyPriority', () => {
  it('persists reply priority settings without scheduling extraction/training', async () => {
    const id = new Types.ObjectId().toString();
    const findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(id),
        status: 'draft',
        name: 'Bot',
        slug: 'bot',
      }),
    });
    const findOneAndUpdate = jest.fn().mockResolvedValue({});
    const svc = Object.create(BotsService.prototype) as {
      updateWorkspaceBot: BotsService['updateWorkspaceBot'];
      botModel: {
        findOne: typeof findOne;
        findOneAndUpdate: typeof findOneAndUpdate;
      };
      assertDocumentsExtractedBeforePublish: jest.Mock;
      knowledgeTrainingJobService?: { scheduleTrainingForScopes: jest.Mock };
      ingestionService?: { ensureQueuedIngestJobsForDocumentIds: jest.Mock };
    };
    svc.botModel = { findOne, findOneAndUpdate };
    svc.assertDocumentsExtractedBeforePublish = jest.fn().mockResolvedValue(undefined);
    svc.knowledgeTrainingJobService = { scheduleTrainingForScopes: jest.fn() };
    svc.ingestionService = { ensureQueuedIngestJobsForDocumentIds: jest.fn() };

    const out = await svc.updateWorkspaceBot(id, {
      touched: new Set(['knowledgeReplyPriority']),
      knowledgeReplyPriority: {
        mode: 'priority',
        sourceOrder: ['faq', 'note', 'table', 'document', 'suggestion'],
      },
    });

    expect(out.ok).toBe(true);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate.mock.calls[0]?.[1]).toMatchObject({
      knowledgeReplyPriority: {
        mode: 'priority',
        sourceOrder: ['faq', 'note', 'table', 'document', 'suggestion'],
      },
    });
    expect(svc.assertDocumentsExtractedBeforePublish).not.toHaveBeenCalled();
    expect(svc.knowledgeTrainingJobService.scheduleTrainingForScopes).not.toHaveBeenCalled();
    expect(svc.ingestionService.ensureQueuedIngestJobsForDocumentIds).not.toHaveBeenCalled();
  });
});
