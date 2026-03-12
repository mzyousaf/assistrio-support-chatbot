/**
 * Post-ranking selection: diversity caps and deduplication for unified retrieval.
 * Keeps the evidence list relevant, compact, and not dominated by one source.
 */

import type { RankedKnowledgeItem } from './unified-retrieval.types';
import type { KnowledgeSourceType } from '../knowledge';
import { tokenize } from './retrieval-helpers';
import type {
  UnifiedRetrievalDiversityOptions,
  DiversitySelectionResult,
  SkippedReason,
} from './unified-retrieval-selection.types';
import { DEFAULT_DIVERSITY_OPTIONS } from './unified-retrieval-selection.types';

function jaccardOverlap(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 && tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Source key for diversity caps: per-document, per-faq (we cap total faq), per-note, per-html-page. */
function sourceKey(item: RankedKnowledgeItem): { key: string; type: KnowledgeSourceType } {
  const type = item.sourceType;
  if (type === 'document') return { key: `doc:${item.sourceId}`, type: 'document' };
  if (type === 'faq') return { key: 'faq', type: 'faq' };
  if (type === 'note') return { key: 'note', type: 'note' };
  if (type === 'html') return { key: `html:${item.sourceId}`, type: 'html' };
  return { key: `${type}:${item.sourceId}`, type };
}

/** Resolve options with defaults. */
function resolveOptions(opts?: UnifiedRetrievalDiversityOptions | null): Required<UnifiedRetrievalDiversityOptions> {
  if (!opts) return DEFAULT_DIVERSITY_OPTIONS;
  return {
    maxChunksPerDocument: opts.maxChunksPerDocument ?? DEFAULT_DIVERSITY_OPTIONS.maxChunksPerDocument,
    maxFaqs: opts.maxFaqs ?? DEFAULT_DIVERSITY_OPTIONS.maxFaqs,
    maxNotes: opts.maxNotes ?? DEFAULT_DIVERSITY_OPTIONS.maxNotes,
    maxHtmlPerPage: opts.maxHtmlPerPage ?? DEFAULT_DIVERSITY_OPTIONS.maxHtmlPerPage,
    textOverlapDuplicateThreshold: opts.textOverlapDuplicateThreshold ?? DEFAULT_DIVERSITY_OPTIONS.textOverlapDuplicateThreshold,
    minTokensForDedup: opts.minTokensForDedup ?? DEFAULT_DIVERSITY_OPTIONS.minTokensForDedup,
  };
}

/** Get cap for this source from options. */
function getCapForKey(
  key: string,
  type: KnowledgeSourceType,
  opts: Required<UnifiedRetrievalDiversityOptions>,
): number {
  if (type === 'document') return opts.maxChunksPerDocument;
  if (type === 'faq') return opts.maxFaqs;
  if (type === 'note') return opts.maxNotes;
  if (type === 'html') return opts.maxHtmlPerPage;
  return opts.maxChunksPerDocument;
}

/**
 * Apply diversity caps and deduplication to a ranked list.
 * Processes in rank order: keeps each item unless (1) its source is at cap, or (2) it is a near-duplicate of an already-selected item.
 * When duplicate: keeps the higher-ranked (already-selected) item; prefers more concise / answer-bearing by virtue of rank.
 */
export function applyDiversityAndDedup(
  items: RankedKnowledgeItem[],
  options?: UnifiedRetrievalDiversityOptions | null,
): DiversitySelectionResult {
  const opts = resolveOptions(options);
  const selected: RankedKnowledgeItem[] = [];
  const removedAsDuplicate: string[] = [];
  const skippedByCap: Array<{ id: string; reason: SkippedReason }> = [];
  const countByKey = new Map<string, number>();
  const selectedNormalizedTexts: Array<{ tokens: string[]; item: RankedKnowledgeItem }> = [];

  for (const item of items) {
    const { key, type } = sourceKey(item);
    const cap = getCapForKey(key, type, opts);
    const current = countByKey.get(key) ?? 0;
    if (current >= cap) {
      const reason: SkippedReason =
        type === 'document' ? 'max_chunks_per_document'
        : type === 'faq' ? 'max_faqs'
        : type === 'note' ? 'max_notes'
        : 'max_html_per_page';
      skippedByCap.push({ id: item.id, reason });
      continue;
    }

    const tokens = tokenize(item.normalizedText);
    const isDuplicate =
      tokens.length >= opts.minTokensForDedup &&
      selectedNormalizedTexts.some((s) => {
        const overlap = jaccardOverlap(tokens, s.tokens);
        return overlap >= opts.textOverlapDuplicateThreshold;
      });

    if (isDuplicate) {
      removedAsDuplicate.push(item.id);
      continue;
    }

    selected.push(item);
    countByKey.set(key, current + 1);
    selectedNormalizedTexts.push({ tokens, item });
  }

  return { selected, removedAsDuplicate, skippedByCap };
}
