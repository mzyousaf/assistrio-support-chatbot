/**
 * Maps stored `personality.language` to the value used in chat behavior / system prompt.
 * `auto`, empty, or whitespace → assistant should match the visitor’s language (no fixed locale).
 */
export function resolvePersonalityLanguageForPrompt(raw: string | undefined): string | undefined {
  const t = (raw ?? '').trim();
  if (!t || t.toLowerCase() === 'auto') return undefined;
  return t;
}
