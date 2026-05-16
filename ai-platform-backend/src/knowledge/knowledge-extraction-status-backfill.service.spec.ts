import { KnowledgeExtractionStatusBackfillService } from './knowledge-extraction-status-backfill.service';

function emptyMongoCursor(): { [Symbol.asyncIterator](): AsyncGenerator<never> } {
  return {
    async *[Symbol.asyncIterator]() {
      // no document rows for this unit test
    },
  };
}

describe('KnowledgeExtractionStatusBackfillService — non-document normalization', () => {
  it('updateMany targets faq/note/table/suggestion with wrong or missing extractionStatus and unsets extractionError', async () => {
    const updateMany = jest.fn().mockResolvedValue({ modifiedCount: 5 });
    const itemModel = {
      collection: { updateMany },
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          batchSize: jest.fn().mockReturnValue({
            cursor: jest.fn().mockReturnValue(emptyMongoCursor()),
          }),
        }),
      }),
    };
    const extractJobModel = {
      aggregate: jest.fn().mockResolvedValue([]),
    };

    const svc = new KnowledgeExtractionStatusBackfillService(itemModel as never, extractJobModel as never);
    const r = await svc.runBackfill();

    expect(r.nonDocumentsUpdated).toBe(5);
    expect(r.documentsUpdated).toBe(0);
    expect(updateMany).toHaveBeenCalledTimes(1);
    const [filter, update] = updateMany.mock.calls[0]!;
    expect(filter).toMatchObject({
      sourceType: { $in: ['faq', 'note', 'table', 'suggestion'] },
    });
    expect((filter as { $and: unknown[] }).$and?.length).toBeGreaterThanOrEqual(2);
    expect(update).toEqual({
      $set: { extractionStatus: 'not_required', updatedAt: expect.any(Date) },
      $unset: { extractionError: '' },
    });
    const f = filter as { $and: [unknown, { $or: unknown[] }] };
    expect(f.$and[1].$or).toEqual(
      expect.arrayContaining([
        { extractionStatus: { $exists: false } },
        { extractionStatus: null },
        { extractionStatus: { $ne: 'not_required' } },
        { $and: [{ extractionStatus: 'not_required' }, { extractionError: { $gt: '' } }] },
      ]),
    );
  });
});
