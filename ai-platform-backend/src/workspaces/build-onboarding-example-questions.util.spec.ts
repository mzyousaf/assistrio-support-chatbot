import { buildOnboardingExampleQuestionsFromProfile } from './build-onboarding-example-questions.util';

describe('buildOnboardingExampleQuestionsFromProfile', () => {
  it('uses category starters and describe-topic questions', () => {
    const questions = buildOnboardingExampleQuestionsFromProfile(
      ['support'],
      'Be helpful when answering customer questions about pricing, product features, refunds, and support policies.',
    );

    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(4);
    expect(questions).toContain('How can I get help?');
    expect(questions.some((q) => /pricing/i.test(q))).toBe(true);
    expect(questions.some((q) => /refund/i.test(q))).toBe(true);
  });

  it('generates a question for custom categories', () => {
    const questions = buildOnboardingExampleQuestionsFromProfile(['real estate'], 'Help buyers compare listings.');
    expect(questions.some((q) => /real estate/i.test(q))).toBe(true);
  });

  it('falls back to generic questions when no category or topic matches', () => {
    expect(buildOnboardingExampleQuestionsFromProfile([], '')).toEqual([
      'How can you help me today?',
      'What services do you offer?',
      'How do I get started?',
    ]);
  });

  it('dedupes similar questions', () => {
    const questions = buildOnboardingExampleQuestionsFromProfile(
      ['support'],
      'Contact support for help with support questions.',
    );
    const lowered = questions.map((q) => q.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
  });
});
