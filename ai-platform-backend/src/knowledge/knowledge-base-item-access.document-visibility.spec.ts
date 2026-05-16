import { Types } from 'mongoose';
import {
  KnowledgeBaseItemAccessService,
  knowledgeItemExcludeDeletedOnlyClause,
} from './knowledge-base-item-access.service';

describe('KnowledgeBaseItemAccessService document visibility', () => {
  it('findKbDocumentItemByRouteId excludes only soft-deleted rows', async () => {
    const lean = jest.fn().mockResolvedValue(null);
    const select = jest.fn().mockReturnValue({ lean });
    const findOne = jest.fn().mockReturnValue({ select });
    const svc = new KnowledgeBaseItemAccessService({ findOne } as never);
    const botId = new Types.ObjectId().toString();
    const routeId = new Types.ObjectId().toString();

    await svc.findKbDocumentItemByRouteId(botId, routeId);

    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: new Types.ObjectId(botId),
        sourceType: 'document',
        _id: new Types.ObjectId(routeId),
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      }),
    );
  });
});
