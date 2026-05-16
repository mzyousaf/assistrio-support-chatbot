import { Types } from 'mongoose';
import {
  KnowledgeBaseItemAccessService,
  knowledgeItemExcludeDeletedOnlyClause,
} from './knowledge-base-item-access.service';

describe('KnowledgeBaseItemAccessService findKnowledgeItemsForBot scopeTrainingExtractionOnly', () => {
  let findMock: jest.Mock;
  let service: KnowledgeBaseItemAccessService;

  beforeEach(() => {
    findMock = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });
    service = new KnowledgeBaseItemAccessService({ find: findMock } as never);
  });

  it('adds extraction eligibility clause for faq when scopeTrainingExtractionOnly', async () => {
    const botId = new Types.ObjectId().toString();
    await service.findKnowledgeItemsForBot(botId, {
      sourceType: 'faq',
      activeOnly: true,
      statuses: ['processing'],
      scopeTrainingExtractionOnly: true,
    });
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: new Types.ObjectId(botId),
        sourceType: 'faq',
        status: { $in: ['processing'] },
        $and: [
          { active: { $ne: false } },
          knowledgeItemExcludeDeletedOnlyClause(),
          {
            $or: [{ extractionStatus: 'not_required' }, { extractionStatus: { $exists: false } }],
          },
        ],
      }),
    );
  });

  it('does not add extraction clause for document when scopeTrainingExtractionOnly', async () => {
    const botId = new Types.ObjectId().toString();
    await service.findKnowledgeItemsForBot(botId, {
      sourceType: 'document',
      activeOnly: true,
      statuses: ['processing'],
      scopeTrainingExtractionOnly: true,
    });
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: [{ active: { $ne: false } }, knowledgeItemExcludeDeletedOnlyClause()],
      }),
    );
  });

  it('does not add extraction clause when scopeTrainingExtractionOnly is false', async () => {
    const botId = new Types.ObjectId().toString();
    await service.findKnowledgeItemsForBot(botId, {
      sourceType: 'faq',
      activeOnly: true,
      statuses: ['processing'],
      scopeTrainingExtractionOnly: false,
    });
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: [{ active: { $ne: false } }, knowledgeItemExcludeDeletedOnlyClause()],
      }),
    );
  });
});
