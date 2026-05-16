import { dedupeFaqKnowledgeItemsForOrderedRead, faqKnowledgeDuplicateIndexIds } from './knowledge-base-item-faq-dedupe.util';

describe('knowledge-base-item-faq-dedupe.util', () => {
  it('dedupeFaqKnowledgeItemsForOrderedRead keeps newest per faqIndex and sorts by index', () => {
    const t0 = new Date('2024-01-01');
    const t1 = new Date('2024-06-01');
    const rows = [
      { _id: 'a', faqMeta: { faqIndex: 0 }, lastContentUpdatedAt: t0 },
      { _id: 'b', faqMeta: { faqIndex: 0 }, lastContentUpdatedAt: t1 },
      { _id: 'c', faqMeta: { faqIndex: 2 }, lastContentUpdatedAt: t0 },
      { _id: 'd', faqMeta: { faqIndex: 1 }, lastContentUpdatedAt: t0 },
    ];
    const out = dedupeFaqKnowledgeItemsForOrderedRead(rows);
    expect(out.map((r) => r._id)).toEqual(['b', 'd', 'c']);
  });

  it('dedupeFaqKnowledgeItemsForOrderedRead appends unindexed rows sorted by time', () => {
    const t0 = new Date('2024-01-01');
    const t1 = new Date('2024-03-01');
    const rows = [
      { _id: 'x', faqMeta: {}, lastContentUpdatedAt: t1 },
      { _id: 'y', faqMeta: { faqIndex: 0 }, lastContentUpdatedAt: t0 },
      { _id: 'z', faqMeta: {}, lastContentUpdatedAt: t0 },
    ];
    const out = dedupeFaqKnowledgeItemsForOrderedRead(rows);
    expect(out.map((r) => r._id)).toEqual(['y', 'z', 'x']);
  });

  it('faqKnowledgeDuplicateIndexIds returns older duplicates only', () => {
    const tOld = new Date('2024-01-01');
    const tNew = new Date('2024-06-01');
    const rows = [
      { _id: 'old', faqMeta: { faqIndex: 0 }, lastContentUpdatedAt: tOld },
      { _id: 'new', faqMeta: { faqIndex: 0 }, lastContentUpdatedAt: tNew },
      { _id: 'solo', faqMeta: { faqIndex: 1 }, lastContentUpdatedAt: tOld },
    ];
    expect(faqKnowledgeDuplicateIndexIds(rows)).toEqual(['old']);
  });
});
