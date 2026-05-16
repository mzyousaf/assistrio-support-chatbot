import { Types } from 'mongoose';
import { KnowledgeBaseItemService } from './knowledge-base-item.service';
import { knowledgeItemExcludeDeletedOnlyClause } from './knowledge-base-item-access.service';

function chainLean<T>(value: T) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(value),
    }),
  };
}

describe('KnowledgeBaseItemService indexed training includes inactive rows', () => {
  it('getIndexedFaqTraining does not filter out active:false rows', async () => {
    const find = jest.fn().mockReturnValue(
      chainLean([{ _id: new Types.ObjectId(), status: 'ready', faqMeta: { faqIndex: 0 }, active: false }]),
    );
    const svc = Object.create(KnowledgeBaseItemService.prototype) as any;
    svc.itemModel = { find } as never;

    await svc.getIndexedFaqTraining(new Types.ObjectId().toString(), 1);

    expect(find).toHaveBeenCalledWith({
      botId: expect.any(Types.ObjectId),
      sourceType: 'faq',
      $and: [knowledgeItemExcludeDeletedOnlyClause()],
    });
  });

  it('getIndexedSnippetTraining does not filter out active:false rows', async () => {
    const find = jest.fn().mockReturnValue(
      chainLean([{ _id: new Types.ObjectId(), status: 'ready', noteMeta: { snippetIndex: 0 }, active: false }]),
    );
    const svc = Object.create(KnowledgeBaseItemService.prototype) as any;
    svc.itemModel = { find } as never;

    await svc.getIndexedSnippetTraining(new Types.ObjectId().toString(), 1);

    expect(find).toHaveBeenCalledWith({
      botId: expect.any(Types.ObjectId),
      sourceType: 'note',
      $and: [
        knowledgeItemExcludeDeletedOnlyClause(),
        {
          $or: [{ 'noteMeta.kind': 'snippet' }, { 'noteMeta.snippetIndex': { $exists: true, $ne: null } }],
        },
      ],
    });
  });

  it('getIndexedSuggestionTraining does not filter out active:false rows', async () => {
    const find = jest.fn().mockReturnValue(
      chainLean([
        { _id: new Types.ObjectId(), status: 'ready', suggestionMeta: { suggestionIndex: 0 }, active: false },
      ]),
    );
    const svc = Object.create(KnowledgeBaseItemService.prototype) as any;
    svc.itemModel = { find } as never;

    await svc.getIndexedSuggestionTraining(new Types.ObjectId().toString(), 1);

    expect(find).toHaveBeenCalledWith({
      botId: expect.any(Types.ObjectId),
      sourceType: 'suggestion',
      $and: [knowledgeItemExcludeDeletedOnlyClause()],
    });
  });
});
