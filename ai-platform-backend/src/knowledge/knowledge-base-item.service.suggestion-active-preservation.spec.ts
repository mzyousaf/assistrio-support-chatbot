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

describe('KnowledgeBaseItemService suggestion edit preserves inactive active=false', () => {
  it('inactive suggestion label edit keeps active:false while updating title/content', async () => {
    const botId = new Types.ObjectId().toString();
    const itemId = new Types.ObjectId();
    const itemModel = {
      find: jest.fn().mockReturnValue(chainLean([{ _id: itemId, suggestionMeta: { suggestionIndex: 0 } }])),
      findById: jest
        .fn()
        .mockReturnValue(chainLean({ status: 'ready', contentHash: 'old-hash', lastTrainedAt: new Date(), active: false })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const botModel = {
      findById: jest.fn().mockReturnValue(chainLean({ exampleQuestions: [{ label: 'Old', context: 'Old scope' }] })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const svc = Object.create(KnowledgeBaseItemService.prototype) as any;
    svc.itemModel = itemModel;
    svc.botModel = botModel;
    svc.refreshBotKnowledgeStats = jest.fn().mockResolvedValue(undefined);
    svc.kickOosReconcile = jest.fn().mockResolvedValue(undefined);
    svc.getBotTrainingSettings = jest.fn().mockResolvedValue({ autoTrainEnabled: false, trainingDelayMinutes: 0 });
    svc.buildTrainableContentStatus = jest.fn().mockReturnValue({ $set: { status: 'pending' }, $unset: {} });
    svc.hasTrainedBeforeFromLean = jest.fn().mockReturnValue(true);
    svc.knowledgeTrainingJobService = { scheduleTrainingForScopes: jest.fn().mockResolvedValue(undefined) };

    await svc.patchCustomerSuggestionChipLabel(botId, 0, 'Updated label');

    expect(itemModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: expect.any(Types.ObjectId),
        sourceType: 'suggestion',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      }),
    );

    const itemUpdateCall = itemModel.updateOne.mock.calls.find(
      (c: unknown[]) => (c[0] as { _id?: { equals?: (v: unknown) => boolean } } | undefined)?._id?.equals?.(itemId),
    );
    const itemUpdate = itemUpdateCall?.[1] as { $set: Record<string, unknown> } | undefined;
    expect(itemUpdate).toBeDefined();
    expect(itemUpdate?.$set.active).toBe(false);
    expect(String(itemUpdate?.$set.title ?? '')).toContain('Updated label');
    expect(String(itemUpdate?.$set.content ?? '')).toContain('Updated label');
  });

  it('inactive suggestion scope edit keeps active:false while updating content', async () => {
    const botId = new Types.ObjectId().toString();
    const itemId = new Types.ObjectId();
    const itemModel = {
      find: jest.fn().mockReturnValue(chainLean([{ _id: itemId, suggestionMeta: { suggestionIndex: 0 } }])),
      findById: jest
        .fn()
        .mockReturnValue(chainLean({ status: 'ready', contentHash: 'old-hash', lastTrainedAt: new Date(), active: false })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const botModel = {
      findById: jest.fn().mockReturnValue(chainLean({ exampleQuestions: [{ label: 'Same label', context: 'Old scope' }] })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const svc = Object.create(KnowledgeBaseItemService.prototype) as any;
    svc.itemModel = itemModel;
    svc.botModel = botModel;
    svc.refreshBotKnowledgeStats = jest.fn().mockResolvedValue(undefined);
    svc.kickOosReconcile = jest.fn().mockResolvedValue(undefined);
    svc.getBotTrainingSettings = jest.fn().mockResolvedValue({ autoTrainEnabled: false, trainingDelayMinutes: 0 });
    svc.buildTrainableContentStatus = jest.fn().mockReturnValue({ $set: { status: 'pending' }, $unset: {} });
    svc.hasTrainedBeforeFromLean = jest.fn().mockReturnValue(true);
    svc.assertKbContentPatchTrainingGate = jest.fn().mockResolvedValue(undefined);
    svc.botKbTotalLimit = {
      assertWithinLimit: jest.fn().mockResolvedValue(undefined),
    };
    svc.knowledgeTrainingJobService = { scheduleTrainingForScopes: jest.fn().mockResolvedValue(undefined) };

    await svc.patchCustomerSuggestionScope(botId, 0, 'Updated scope');

    expect(itemModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: expect.any(Types.ObjectId),
        sourceType: 'suggestion',
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      }),
    );

    const itemUpdateCall = itemModel.updateOne.mock.calls.find(
      (c: unknown[]) => (c[0] as { _id?: { equals?: (v: unknown) => boolean } } | undefined)?._id?.equals?.(itemId),
    );
    const itemUpdate = itemUpdateCall?.[1] as { $set: Record<string, unknown> } | undefined;
    expect(itemUpdate).toBeDefined();
    expect(itemUpdate?.$set.active).toBe(false);
    expect(String(itemUpdate?.$set.content ?? '')).toContain('Updated scope');
    expect(String(itemUpdate?.$set.rawContent ?? '')).toContain('Updated scope');
  });
});
