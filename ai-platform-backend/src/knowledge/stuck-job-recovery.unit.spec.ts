import { knowledgeItemNotDeletedClause } from './knowledge-base-item-access.service';

describe('stuck job recovery (unit guards)', () => {
  it('knowledgeItemNotDeletedClause requires active training-visible rows', () => {
    const c = knowledgeItemNotDeletedClause() as { $and: Array<Record<string, unknown>> };
    expect(c.$and[0]).toEqual({ active: { $ne: false } });
  });
});
