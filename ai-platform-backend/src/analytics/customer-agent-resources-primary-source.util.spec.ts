import {
  assistantPrimarySourceElementExpr,
  pickPrimarySourceForAnalytics,
  type SourceLikeWithScore,
} from './customer-agent-resources-primary-source.util';

describe('pickPrimarySourceForAnalytics', () => {
  it('returns none when sources empty', () => {
    expect(pickPrimarySourceForAnalytics(undefined)).toEqual({ kind: 'none' });
    expect(pickPrimarySourceForAnalytics([])).toEqual({ kind: 'none' });
  });

  it('picks highest finite score with earliest tie break', () => {
    expect(
      pickPrimarySourceForAnalytics([
        { score: 1 },
        { score: 2 },
        { score: 2 },
      ]),
    ).toMatchObject({ kind: 'primary', index: 1, source: { score: 2 } });

    expect(pickPrimarySourceForAnalytics([{ score: null }, { score: 10 }, { score: 10 }])).toMatchObject({
      kind: 'primary',
      index: 1,
      source: { score: 10 },
    });
  });

  it('falls back to first entry when nothing has a finite numeric score', () => {
    expect(
      pickPrimarySourceForAnalytics([
        {},
        { score: 'not-a-number' as unknown as number },
        { score: NaN },
      ]),
    ).toMatchObject({ kind: 'primary', index: 0 });

    expect(
      pickPrimarySourceForAnalytics([
        { score: null },
        { score: Number.POSITIVE_INFINITY },
      ] as SourceLikeWithScore[]),
    ).toMatchObject({ kind: 'primary', index: 0 });
  });

  it('prefers finite highest score among mixed finite and non-scoring rows', () => {
    expect(
      pickPrimarySourceForAnalytics([
        { score: undefined },
        { score: 0.25 },
        { score: 0 },
        {},
      ]),
    ).toMatchObject({ kind: 'primary', index: 1, source: { score: 0.25 } });
  });

  it('ignores non-numeric string scores and falls back to first source', () => {
    expect(
      pickPrimarySourceForAnalytics([
        { score: '0.95' },
        { score: 1 },
      ] as SourceLikeWithScore[]),
    ).toMatchObject({ kind: 'primary', index: 1, source: { score: 1 } });

    expect(
      pickPrimarySourceForAnalytics([{ score: 'x' }, { id: 'b' }] as SourceLikeWithScore[]),
    ).toMatchObject({ kind: 'primary', index: 0, source: expect.objectContaining({ score: 'x' }) });
  });

  it('handles a single sourced message', () => {
    expect(pickPrimarySourceForAnalytics([{ score: 3 }])).toMatchObject({
      kind: 'primary',
      index: 0,
      source: { score: 3 },
    });
  });
});

describe('assistantPrimarySourceElementExpr', () => {
  it('exports nested $reduce $let aggregation without sibling-var $$el antipattern', () => {
    const serialized = JSON.stringify(assistantPrimarySourceElementExpr());
    expect(serialized).toContain('$reduce');
    expect(serialized).toContain('currentEl');
    /** Prior bug: hasNum sibling referenced $$el.score while `el` was defined in same `vars`. */
    expect(serialized).not.toContain('$$el');
  });
});