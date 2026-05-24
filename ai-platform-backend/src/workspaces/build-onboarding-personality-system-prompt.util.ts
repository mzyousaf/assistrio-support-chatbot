/** Mirrors customer Behavior editor preset prompt for `default`. */
export function behaviorPresetPromptLine(behaviorPreset: string): string {
  switch (behaviorPreset) {
    case 'support':
      return 'You are a friendly support agent. Be concise and helpful.';
    case 'sales':
      return 'You are a sales assistant. Clarify needs and propose best options.';
    case 'technical':
      return 'You are a technical assistant. Be precise and step-by-step.';
    default:
      return 'You are a helpful assistant.';
  }
}

/** Same shape as customer Behavior save: preset line + editable instructions. */
export function buildOnboardingPersonalitySystemPrompt(
  behaviorPreset: string,
  instructions: string,
): string {
  const presetLine = behaviorPresetPromptLine(behaviorPreset);
  const body = String(instructions ?? '').trim();
  if (!body) return presetLine;
  return `${presetLine}\n\nAdditional behavior:\n${body}`;
}
