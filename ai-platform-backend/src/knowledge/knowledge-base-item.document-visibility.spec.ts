import { Types } from 'mongoose';
import { KnowledgeBaseItemService } from './knowledge-base-item.service';
import { knowledgeItemExcludeDeletedOnlyClause } from './knowledge-base-item-access.service';

describe('KnowledgeBaseItemService document visibility', () => {
  it('listKbDocumentRowsPaginated includes active:false rows (filters only deletedAt)', async () => {
    const lean = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    const select = jest.fn().mockReturnValue({ sort });
    const find = jest.fn().mockReturnValue({ select });
    const countDocuments = jest.fn().mockResolvedValue(0);
    const svc = Object.create(KnowledgeBaseItemService.prototype) as {
      listKbDocumentRowsPaginated: KnowledgeBaseItemService['listKbDocumentRowsPaginated'];
      itemModel: { find: typeof find; countDocuments: typeof countDocuments };
    };
    svc.itemModel = { find, countDocuments };
    const botId = new Types.ObjectId().toString();

    await svc.listKbDocumentRowsPaginated(botId, 1, 10);

    const expectedFilter = {
      botId: new Types.ObjectId(botId),
      sourceType: 'document',
      $and: [knowledgeItemExcludeDeletedOnlyClause()],
    };
    expect(find).toHaveBeenCalledWith(expectedFilter);
    expect(countDocuments).toHaveBeenCalledWith(expectedFilter);
  });

  it('listLightweightTrainingStatuses includes inactive rows for status polling', async () => {
    const lean = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ lean });
    const select = jest.fn().mockReturnValue({ sort, lean });
    const find = jest.fn().mockReturnValue({ select });
    const svc = Object.create(KnowledgeBaseItemService.prototype) as {
      listLightweightTrainingStatuses: KnowledgeBaseItemService['listLightweightTrainingStatuses'];
      itemModel: { find: typeof find };
      loadDocumentIngestJobContext: jest.Mock;
    };
    svc.itemModel = { find };
    svc.loadDocumentIngestJobContext = jest.fn().mockResolvedValue({
      mergedIngestByKbId: new Map(),
      embedByKbId: new Map(),
      extractLatestByKbId: new Map(),
    });
    const botId = new Types.ObjectId().toString();

    await svc.listLightweightTrainingStatuses(botId, 'document');

    expect(select).toHaveBeenCalledWith(expect.stringContaining('active'));
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: new Types.ObjectId(botId),
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      }),
    );
  });
});
