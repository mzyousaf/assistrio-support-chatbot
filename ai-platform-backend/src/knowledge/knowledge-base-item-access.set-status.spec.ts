import { Types } from 'mongoose';
import { KnowledgeBaseItemAccessService } from './knowledge-base-item-access.service';

describe('KnowledgeBaseItemAccessService.setKnowledgeItemStatusById', () => {
  it('maps failed + errorMessage to Mongo trainingError (same field as listLightweightTrainingStatuses.trainingError)', async () => {
    const updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    const svc = new KnowledgeBaseItemAccessService({ updateOne } as never);
    const id = new Types.ObjectId();
    await svc.setKnowledgeItemStatusById(id, 'failed', { errorMessage: 'faq_chunk_persist_failed' });
    expect(updateOne).toHaveBeenCalledWith(
      { _id: id },
      {
        $set: expect.objectContaining({
          status: 'failed',
          trainingError: 'faq_chunk_persist_failed',
          updatedAt: expect.any(Date),
        }),
      },
    );
  });
});
