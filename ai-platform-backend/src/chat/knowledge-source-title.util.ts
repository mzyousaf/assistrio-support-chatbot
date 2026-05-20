import { extractChunkHeading } from '../rag/retrieval-helpers';

const UNTITLED = 'untitled';

/**
 * Best display/prompt title for a knowledge chunk.
 * Priority: KB item title → section/heading → bracket heading in text → fallback.
 */
export function resolveKnowledgeSourceTitle(input: {
  title?: string;
  section?: string;
  text?: string;
}): string {
  const rawTitle = (input.title ?? '').trim();
  if (rawTitle && rawTitle.toLowerCase() !== UNTITLED) return rawTitle;

  const section = (input.section ?? '').trim();
  if (section && section.toLowerCase() !== UNTITLED) return section;

  const fromHeading = extractChunkHeading(input.text ?? '');
  if (fromHeading) {
    const cleaned = fromHeading.replace(/^\d+\.\s*/, '').trim();
    if (cleaned && cleaned.toLowerCase() !== UNTITLED) return cleaned;
  }

  const firstLine = (input.text ?? '').trim().split('\n')[0]?.trim() ?? '';
  const bracket = firstLine.match(/^\[([^\]]+)\]/);
  if (bracket) {
    const cleaned = bracket[1].replace(/^\d+\.\s*/, '').trim();
    if (cleaned && cleaned.toLowerCase() !== UNTITLED) return cleaned;
  }

  return 'Knowledge source';
}
