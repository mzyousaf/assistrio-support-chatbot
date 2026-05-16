/**
 * Text normalization for unified knowledge items.
 * Used for lexical scoring; original text is kept unchanged for prompt use.
 */

/**
 * Normalize text for lexical scoring and comparison:
 * - lowercase
 * - trim
 * - collapse repeated whitespace to single space
 * - reduce excessive line breaks (3+ newlines → 2)
 */
export function normalizeKnowledgeText(text: string): string {
  if (text == null || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
