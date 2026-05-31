import { buildAgentDescriptionFromOnboardingInstructions } from './build-agent-description-from-onboarding-instructions.util';

describe('buildAgentDescriptionFromOnboardingInstructions', () => {
  const longInstructions =
    'Be helpful when answering customer questions about pricing, product features, refunds, and support policies for our online store. Always stay polite and escalate billing issues to a human when needed.';

  it('returns a short description, not the full instruction text', () => {
    const out = buildAgentDescriptionFromOnboardingInstructions(longInstructions);
    expect(out.length).toBeLessThanOrEqual(480);
    expect(out).not.toBe(longInstructions);
    expect(out).toMatch(/This AI Agent helps customers/i);
  });

  it('avoids behavior headings and rule blocks', () => {
    const out = buildAgentDescriptionFromOnboardingInstructions(longInstructions);
    expect(out).not.toContain('Responsibilities:');
    expect(out).not.toContain('Bot Instructions');
    expect(out).not.toContain('Escalation');
  });

  it('uses concise lead sentences when already short and readable', () => {
    const concise =
      'We help homeowners choose solar panels and understand installation timelines. Our team focuses on clear pre-sale guidance.';
    const out = buildAgentDescriptionFromOnboardingInstructions(concise);
    expect(out).toContain('solar panels');
    expect(out.length).toBeLessThan(300);
  });
});
