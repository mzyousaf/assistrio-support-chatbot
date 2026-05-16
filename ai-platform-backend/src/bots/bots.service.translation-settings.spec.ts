import { Types } from 'mongoose';
import { HttpException } from '@nestjs/common';
import { BotsService } from './bots.service';
import { normalizeWorkspaceBotPatch } from '../workspace/shared/bot-payload';

describe('translation settings patch behavior', () => {
  it('normalizes disabled translation to english_only defaults', () => {
    const patch = normalizeWorkspaceBotPatch({
      translationSettings: { enabled: false, mode: 'auto' },
    });
    expect(patch.translationSettings).toEqual({
      enabled: false,
      mode: 'english_only',
      transcriptLanguage: 'english',
    });
  });

  it('requires fixedLanguage when fixed mode is enabled', () => {
    expect(() =>
      normalizeWorkspaceBotPatch({
        translationSettings: { enabled: true, mode: 'fixed' },
      }),
    ).toThrow(HttpException);
  });

  it('persists translation settings without scheduling extraction/training', async () => {
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
      touched: new Set(['translationSettings']),
      translationSettings: {
        enabled: true,
        mode: 'auto',
        transcriptLanguage: 'english',
      },
    });

    expect(out.ok).toBe(true);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(findOneAndUpdate.mock.calls[0]?.[1]).toMatchObject({
      translationSettings: {
        enabled: true,
        mode: 'auto',
        transcriptLanguage: 'english',
      },
    });
    expect(svc.assertDocumentsExtractedBeforePublish).not.toHaveBeenCalled();
    expect(svc.knowledgeTrainingJobService?.scheduleTrainingForScopes).not.toHaveBeenCalled();
    expect(svc.ingestionService?.ensureQueuedIngestJobsForDocumentIds).not.toHaveBeenCalled();
  });
});
