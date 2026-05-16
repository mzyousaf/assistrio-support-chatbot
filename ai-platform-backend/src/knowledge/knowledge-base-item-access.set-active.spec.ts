import { Types } from 'mongoose';
import { KnowledgeBaseItemAccessService, knowledgeItemExcludeDeletedOnlyClause } from './knowledge-base-item-access.service';

describe('KnowledgeBaseItemAccessService.setKnowledgeItemActiveById', () => {
  it('updates only active/updatedAt for FAQ items', async () => {
    const updateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });
    const svc = new KnowledgeBaseItemAccessService({ updateOne } as never);
    const botId = new Types.ObjectId().toString();
    const itemId = new Types.ObjectId();

    const ok = await svc.setKnowledgeItemActiveById(botId, itemId, false);

    expect(ok).toBe(true);
    expect(updateOne).toHaveBeenCalledWith(
      {
        botId: new Types.ObjectId(botId),
        _id: itemId,
        $and: [knowledgeItemExcludeDeletedOnlyClause()],
      },
      {
        $set: {
          active: false,
          updatedAt: expect.any(Date),
        },
      },
    );
  });

  it('uses the same active-only patch for note/table/suggestion items and keeps non-content fields untouched', async () => {
    const updateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });
    const svc = new KnowledgeBaseItemAccessService({ updateOne } as never);
    const botId = new Types.ObjectId().toString();
    const itemId = new Types.ObjectId();

    await svc.setKnowledgeItemActiveById(botId, itemId, false);
    await svc.setKnowledgeItemActiveById(botId, itemId, true);

    for (const call of updateOne.mock.calls) {
      const update = call[1] as { $set: Record<string, unknown> };
      expect(update.$set.active === false || update.$set.active === true).toBe(true);
      expect(update.$set.updatedAt).toBeInstanceOf(Date);
      expect(update.$set).not.toHaveProperty('contentHash');
      expect(update.$set).not.toHaveProperty('extractionStatus');
      expect(update.$set).not.toHaveProperty('status');
    }
  });

  it('returns false when no item matches', async () => {
    const updateOne = jest.fn().mockResolvedValue({ matchedCount: 0 });
    const svc = new KnowledgeBaseItemAccessService({ updateOne } as never);
    const botId = new Types.ObjectId().toString();
    const itemId = new Types.ObjectId();

    await expect(svc.setKnowledgeItemActiveById(botId, itemId, false)).resolves.toBe(false);
  });
});
