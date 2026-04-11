/** Text snippet field — character limit and helpers. */

export { TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS } from "./trial-knowledge-limits";

import { TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS } from "./trial-knowledge-limits";

export const TRIAL_KNOWLEDGE_SNIPPET_MIN_CHARS = 200;

export function truncateNotesToMaxChars(text: string, maxChars = TRIAL_KNOWLEDGE_SNIPPET_MAX_CHARS): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}
