/** Mirrors `$addFields` in aggregateCustomerTrainingLifecycleMetrics (training vs extraction). */
describe('KB training lifecycle metric flags (document extraction split)', () => {
  function documentEligibleForKbTrainingBuckets(r: {
    sourceType?: string;
    extractionStatus?: string;
    isContentExtracted?: boolean;
  }): boolean {
    return (
      r.sourceType !== 'document' ||
      r.extractionStatus === 'done' ||
      r.isContentExtracted === true
    );
  }

  function trainingFailedCounts(r: { status?: string } & Parameters<typeof documentEligibleForKbTrainingBuckets>[0]): boolean {
    return r.status === 'failed' && documentEligibleForKbTrainingBuckets(r);
  }

  function extractionFailedActionable(r: { sourceType?: string; extractionStatus?: string }): boolean {
    return r.sourceType === 'document' && r.extractionStatus === 'failed';
  }

  it('does not treat extraction-failed documents as training failed', () => {
    expect(
      trainingFailedCounts({
        sourceType: 'document',
        status: 'failed',
        extractionStatus: 'failed',
        isContentExtracted: false,
      }),
    ).toBe(false);
  });

  it('still counts real training failures after extraction is done', () => {
    expect(
      trainingFailedCounts({
        sourceType: 'document',
        status: 'failed',
        extractionStatus: 'done',
        isContentExtracted: true,
      }),
    ).toBe(true);
  });

  it('treats extraction-failed documents as action-needed in pending-style tallies', () => {
    expect(extractionFailedActionable({ sourceType: 'document', extractionStatus: 'failed' })).toBe(true);
  });

  it('non-documents with status failed still count as training failed', () => {
    expect(
      trainingFailedCounts({
        sourceType: 'faq',
        status: 'failed',
      }),
    ).toBe(true);
  });
});
