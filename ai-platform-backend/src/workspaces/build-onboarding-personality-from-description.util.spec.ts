import {
  buildOnboardingPersonalityFromDescription,
  inferOnboardingPersonalityTone,
} from './build-onboarding-personality-from-description.util';

describe('buildOnboardingPersonalityFromDescription', () => {
  const userDescription =
    'We sell eco-friendly home products online. Help shoppers compare items, understand shipping, and answer pre-sale questions about materials and sustainability.';

  it('defaults tone to friendly when unclear', () => {
    expect(inferOnboardingPersonalityTone(userDescription)).toBe('friendly');
    expect(buildOnboardingPersonalityFromDescription(userDescription).tone).toBe('friendly');
  });

  it('includes business context in instructions', () => {
    const built = buildOnboardingPersonalityFromDescription(userDescription);
    expect(built.instructions).toContain(userDescription);
    expect(built.instructions).toContain('Business context:');
    expect(built.instructions).toContain('Responsibilities:');
    expect(built.instructions).not.toContain('--- Response rules ---');
  });

  it('builds systemPrompt from preset + instructions only', () => {
    const built = buildOnboardingPersonalityFromDescription(userDescription);
    expect(built.systemPrompt).toMatch(/^You are a helpful assistant\./);
    expect(built.systemPrompt).toContain('Additional behavior:');
    expect(built.systemPrompt).toContain(built.instructions);
    expect(built.systemPrompt).not.toContain('Fallback response:');
    expect(built.systemPrompt).not.toContain('Escalation rules:');
    const firstAdditional = built.systemPrompt.indexOf('Additional behavior:');
    const secondAdditional = built.systemPrompt.indexOf('Additional behavior:', firstAdditional + 1);
    expect(secondAdditional).toBe(-1);
  });

  it('uses default helper preset', () => {
    expect(buildOnboardingPersonalityFromDescription(userDescription).behaviorPreset).toBe('default');
  });

  it('returns short avoid lines, one idea per line', () => {
    const built = buildOnboardingPersonalityFromDescription(userDescription);
    const lines = built.avoidInstructions.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(4);
    for (const line of lines) {
      expect(line.startsWith('- ')).toBe(true);
      expect(line.length).toBeLessThan(160);
    }
    expect(built.avoidInstructions).not.toContain('Business context:');
    expect(built.avoidInstructions).not.toContain(userDescription);
  });
});
