import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { BotOnboardingService } from './bot-onboarding.service';
import { BotsService } from '../../bots/bots.service';
import { DocumentsService } from '../../documents/documents.service';
import { IngestionService } from '../../ingestion/ingestion.service';
import { KnowledgeBaseItemService } from '../../knowledge/knowledge-base-item.service';
import { DEFAULT_NEW_BOT_TEMPLATE_DOCUMENT_COUNT } from './default-new-bot.payload';

describe('BotOnboardingService', () => {
  const botId = new Types.ObjectId().toString();

  let service: BotOnboardingService;
  let documentsService: { create: jest.Mock };
  let ingestionService: { createQueuedJob: jest.Mock };
  let knowledgeBaseItemService: {
    getKnowledgeTrainingSettingsForBot: jest.Mock;
    upsertNoteKnowledgeItemForBot: jest.Mock;
    upsertFaqKnowledgeItemsForBot: jest.Mock;
    upsertSuggestionKnowledgeItemsForBot: jest.Mock;
  };

  beforeEach(async () => {
    documentsService = { create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) };
    ingestionService = { createQueuedJob: jest.fn().mockResolvedValue(undefined) };
    knowledgeBaseItemService = {
      getKnowledgeTrainingSettingsForBot: jest.fn(),
      upsertNoteKnowledgeItemForBot: jest.fn().mockResolvedValue(undefined),
      upsertFaqKnowledgeItemsForBot: jest.fn().mockResolvedValue({ upserted: 0, deactivated: 0 }),
      upsertSuggestionKnowledgeItemsForBot: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BotOnboardingService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        {
          provide: BotsService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              _id: botId,
              name: 'Test',
              description: 'd',
              exampleQuestions: [],
            }),
          },
        },
        { provide: DocumentsService, useValue: documentsService },
        { provide: IngestionService, useValue: ingestionService },
        { provide: KnowledgeBaseItemService, useValue: knowledgeBaseItemService },
      ],
    }).compile();

    service = moduleRef.get(BotOnboardingService);
  });

  it('onboardNewBot passes pending document training status and skips ingest jobs when autoTrain is off', async () => {
    knowledgeBaseItemService.getKnowledgeTrainingSettingsForBot.mockResolvedValue({
      autoTrainEnabled: false,
      trainingDelayMinutes: 5,
      scheduleMode: 'smart',
    });

    const { docsQueued } = await service.onboardNewBot(botId);

    expect(docsQueued).toBe(0);
    expect(ingestionService.createQueuedJob).not.toHaveBeenCalled();
    expect(documentsService.create).toHaveBeenCalledTimes(DEFAULT_NEW_BOT_TEMPLATE_DOCUMENT_COUNT);
    for (const call of documentsService.create.mock.calls) {
      expect(call[0]).toMatchObject({ status: 'pending' });
    }
  });

  it('onboardNewBot queues template documents and enqueues ingest when autoTrain is on', async () => {
    knowledgeBaseItemService.getKnowledgeTrainingSettingsForBot.mockResolvedValue({
      autoTrainEnabled: true,
      trainingDelayMinutes: 5,
      scheduleMode: 'smart',
    });

    const { docsQueued } = await service.onboardNewBot(botId);

    expect(docsQueued).toBe(DEFAULT_NEW_BOT_TEMPLATE_DOCUMENT_COUNT);
    expect(ingestionService.createQueuedJob).toHaveBeenCalledTimes(DEFAULT_NEW_BOT_TEMPLATE_DOCUMENT_COUNT);
    for (const call of documentsService.create.mock.calls) {
      expect(call[0]).toMatchObject({ status: 'queued' });
    }
  });
});
