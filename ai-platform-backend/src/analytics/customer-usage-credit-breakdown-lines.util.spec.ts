import {
  accumulateCreditBreakdownLinesInto,
  buildUsageComponentDisplayRowsFromAccumulator,
  emptyComponentAccumulator,
  normalizeCreditBreakdownLinesFromUnknown,
  sumBillableUsageComponentCredits,
} from './customer-usage-credit-breakdown-lines.util';

describe('customer-usage-credit-breakdown-lines.util', () => {
  it('aggregates dictation composite lines without double-counting keys', () => {
    const acc = emptyComponentAccumulator();
    accumulateCreditBreakdownLinesInto(
      acc,
      normalizeCreditBreakdownLinesFromUnknown([
        { key: 'text_message', count: 1, creditsUsed: 1 },
        { key: 'dictation_session', count: 2, creditsUsed: 0.5 },
      ]),
    );
    expect(acc.textMessages).toBe(1);
    expect(acc.dictationSessions).toBe(2);
    expect(acc.textCredits).toBe(1);
    expect(acc.dictationCredits).toBe(0.5);
  });

  it('preserves zero-credit attachment rows', () => {
    const acc = emptyComponentAccumulator();
    accumulateCreditBreakdownLinesInto(
      acc,
      normalizeCreditBreakdownLinesFromUnknown([{ key: 'attachment_message', count: 1, creditsUsed: 0 }]),
    );
    expect(acc.attachmentMessages).toBe(1);
    expect(acc.attachmentCredits).toBe(0);
  });

  it('text + attachment breakdown sums attachment credits as zero', () => {
    const acc = emptyComponentAccumulator();
    accumulateCreditBreakdownLinesInto(
      acc,
      normalizeCreditBreakdownLinesFromUnknown([
        { key: 'text_message', count: 1, creditsUsed: 1 },
        { key: 'attachment_message', count: 1, creditsUsed: 0 },
      ]),
    );
    expect(acc.textCredits).toBe(1);
    expect(acc.attachmentCredits).toBe(0);
    expect(acc.totalCreditsFromLines).toBe(1);
  });

  it('uses count × creditsEach when persisted creditsUsed is wrong for dictation_session', () => {
    const acc = emptyComponentAccumulator();
    accumulateCreditBreakdownLinesInto(
      acc,
      normalizeCreditBreakdownLinesFromUnknown([
        { key: 'dictation_session', count: 2, creditsEach: 0.25, creditsUsed: 4 },
      ]),
    );
    expect(acc.dictationSessions).toBe(2);
    expect(acc.dictationCredits).toBe(0.5);
    expect(acc.totalCreditsFromLines).toBe(0.5);
  });

  it('display rows use dictation_session count × 0.25 for creditsUsed', () => {
    const acc = emptyComponentAccumulator();
    acc.dictationSessions = 7;
    const rows = buildUsageComponentDisplayRowsFromAccumulator(acc);
    const dictRow = rows.find((r) => r.key === 'dictation_session');
    expect(dictRow?.count).toBe(7);
    expect(dictRow?.creditsEach).toBe(0.25);
    expect(dictRow?.creditsUsed).toBe(1.75);
  });

  it('sumBillableUsageComponentCredits matches sum of billable rows only', () => {
    const acc = emptyComponentAccumulator();
    acc.textMessages = 1;
    acc.dictationSessions = 7;
    const rows = buildUsageComponentDisplayRowsFromAccumulator(acc);
    expect(sumBillableUsageComponentCredits(rows)).toBeCloseTo(2.75);
  });

  it('text row creditsUsed stays aligned with breakdown text_message count', () => {
    const acc = emptyComponentAccumulator();
    acc.textMessages = 44;
    const rows = buildUsageComponentDisplayRowsFromAccumulator(acc);
    const textRow = rows.find((r) => r.key === 'text_message');
    expect(textRow?.count).toBe(44);
    expect(textRow?.creditsUsed).toBe(44);
  });

  it('folds suggested_question_message counts/credits into text_message rows only', () => {
    const acc = emptyComponentAccumulator();
    acc.textMessages = 44;
    acc.suggestedQuestionMessages = 6;
    const rows = buildUsageComponentDisplayRowsFromAccumulator(acc);
    expect(rows.some((r) => r.key === 'suggested_question_message')).toBe(false);
    const textRow = rows.find((r) => r.key === 'text_message');
    expect(textRow?.count).toBe(50);
    expect(textRow?.creditsUsed).toBe(50);
    expect(sumBillableUsageComponentCredits(rows)).toBe(50);
  });
});
