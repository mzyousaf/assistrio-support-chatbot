import { exampleQuestionDocsToMongoArray, parseExampleQuestionsFromDoc } from './example-questions.util';

describe('example questions active preservation', () => {
  it('keeps active:false when parsing object entries', () => {
    const parsed = parseExampleQuestionsFromDoc([
      { label: 'Ask pricing', context: 'Scoped details', active: false },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      label: 'Ask pricing',
      context: 'Scoped details',
      active: false,
    });
  });

  it('writes active:false back to mongo payload', () => {
    const mongo = exampleQuestionDocsToMongoArray([
      { label: 'Ask pricing', context: 'Scoped details', active: false },
      { label: 'Ask support', active: true },
    ]);

    expect(mongo).toEqual([
      { label: 'Ask pricing', context: 'Scoped details', active: false },
      { label: 'Ask support' },
    ]);
  });
});
