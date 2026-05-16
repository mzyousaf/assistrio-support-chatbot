import { mapSourceTypeToUiBucket, getCharacterCountForKbItemStats } from './knowledge-stats.service';

describe('mapSourceTypeToUiBucket', () => {
  it('maps faq to qna', () => {
    expect(mapSourceTypeToUiBucket('faq')).toBe('qna');
  });
});

describe('getCharacterCountForKbItemStats', () => {
  it('uses persisted characterCount for documents', () => {
    expect(
      getCharacterCountForKbItemStats({
        sourceType: 'document',
        content: '',
        characterCount: 48,
      }),
    ).toBe(48);
  });

  it('sums slices for stats aggregation examples', () => {
    const slices = [
      getCharacterCountForKbItemStats({ sourceType: 'document', content: '', characterCount: 400 }),
      getCharacterCountForKbItemStats({ sourceType: 'document', content: '', characterCount: 80 }),
    ];
    expect(slices.reduce((s, n) => s + n, 0)).toBe(480);
  });

  it('suggestion stats use scoped information length, not chip or content', () => {
    expect(
      getCharacterCountForKbItemStats({
        sourceType: 'suggestion',
        content: 'chip line and scope combined',
        suggestionMeta: { scopedInformation: 'scope' },
      }),
    ).toBe(5);
  });

  it('suggestion without characterCount estimates from rawContent context only', () => {
    expect(
      getCharacterCountForKbItemStats({
        sourceType: 'suggestion',
        content: 'ignored for stats',
        rawContent: JSON.stringify({ label: 'Hi', context: 'body' }),
      }),
    ).toBe(4);
  });
});
