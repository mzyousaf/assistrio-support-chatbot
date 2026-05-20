import type { RankedKnowledgeItem } from '../rag/unified-retrieval.types';
import type { QuestionClassification } from './answerability.types';
import { isCompanyOverviewQuestion } from './answerability.helper';

const OVERVIEW_TITLE_BOOST =
  /\b(introduction|intro|overview|product|feature|value proposition|how .+ works|company information|company overview|what does|main features?|key features?|what sources|train(?:ing)?|knowledge base)\b/i;

const LOW_PRIORITY_FOR_OVERVIEW =
  /\b(headquarters|our team|leadership|management team|located in|office address|meet the team|board of directors)\b/i;

/**
 * Re-order retrieved chunks for broad company/product overview questions so top prompt
 * evidence favors overview/value-prop/product chunks over HQ/team noise.
 */
export function rerankEvidenceForQuestion(
  items: RankedKnowledgeItem[],
  message: string,
  classification: QuestionClassification,
): RankedKnowledgeItem[] {
  if (items.length <= 1 || !isCompanyOverviewQuestion(message, classification)) {
    return items;
  }

  const scored = items.map((item) => {
    const title = `${item.title ?? ''} ${item.section ?? ''}`.toLowerCase();
    let boost = 0;
    if (OVERVIEW_TITLE_BOOST.test(title)) boost += 0.1;
    if (LOW_PRIORITY_FOR_OVERVIEW.test(title)) boost -= 0.08;
    const textHead = (item.text ?? '').slice(0, 280).toLowerCase();
    if (OVERVIEW_TITLE_BOOST.test(textHead)) boost += 0.04;
    if (LOW_PRIORITY_FOR_OVERVIEW.test(textHead)) boost -= 0.04;
    return { item, sortScore: (item.combinedScore ?? 0) + boost };
  });

  scored.sort((a, b) => b.sortScore - a.sortScore);
  return scored.map((s) => s.item);
}
