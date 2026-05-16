import {
  knowledgeBaseItemIsEffectivelyDeleted,
  knowledgeItemExcludeDeletedOnlyClause,
  knowledgeItemNotDeletedClause,
  knowledgeItemReplyEligibleClause,
  scopeTrainingExtractionEligibleClause,
} from './knowledge-base-item-access.service';

describe('knowledge live row filters', () => {
  it('knowledgeItemExcludeDeletedOnlyClause omits soft-deleted rows', () => {
    expect(knowledgeItemExcludeDeletedOnlyClause()).toEqual({
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    });
  });

  it('knowledgeItemNotDeletedClause requires active and not soft-deleted', () => {
    const c = knowledgeItemNotDeletedClause() as {
      $and: Array<Record<string, unknown>>;
    };
    expect(c.$and).toHaveLength(2);
    expect(c.$and?.[0]).toEqual({ active: { $ne: false } });
    expect(c.$and?.[1]).toEqual(knowledgeItemExcludeDeletedOnlyClause());
  });

  it('knowledgeItemReplyEligibleClause matches knowledgeItemNotDeletedClause', () => {
    expect(JSON.stringify(knowledgeItemReplyEligibleClause())).toBe(
      JSON.stringify(knowledgeItemNotDeletedClause()),
    );
  });

  it('scopeTrainingExtractionEligibleClause matches not_required or legacy missing field', () => {
    expect(scopeTrainingExtractionEligibleClause()).toEqual({
      $or: [{ extractionStatus: 'not_required' }, { extractionStatus: { $exists: false } }],
    });
  });
});

describe('knowledgeBaseItemIsEffectivelyDeleted', () => {
  it('is false without a soft-delete timestamp (reply exclusion uses active, not deletedAt)', () => {
    expect(knowledgeBaseItemIsEffectivelyDeleted({})).toBe(false);
    expect(knowledgeBaseItemIsEffectivelyDeleted({ deletedAt: null })).toBe(false);
  });

  it('is true when deletedAt is a valid date', () => {
    expect(knowledgeBaseItemIsEffectivelyDeleted({ deletedAt: new Date() })).toBe(true);
  });
});
